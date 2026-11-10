import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';
import '../../models/farmer_models.dart';
import '../../services/farmer_state.dart';
import '../../services/app_language.dart';
import 'order_prepare_screen.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  bool _isBusy = false;

  @override
  void initState() {
    super.initState();
    FarmerState().refreshOrders();
  }

  String _shortDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final s = raw.trim();
    final clean = s.contains(',') ? s.split(',')[0].trim() : s;
    if (RegExp(r'^\d{1,2}/\d{1,2}/\d{2,4}$').hasMatch(clean)) {
      return clean;
    }
    if (RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(clean)) {
      final parts = clean.substring(0, 10).split('-');
      return '${parts[2]}/${parts[1]}/${parts[0]}';
    }
    final d = DateTime.tryParse(clean);
    if (d != null) {
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    }
    return clean;
  }

  String _formatTime12h(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    final s = raw.trim();
    if (s.toLowerCase().contains('am') || s.toLowerCase().contains('pm')) {
      return s.toUpperCase();
    }
    final match = RegExp(r'^(\d{1,2}):(\d{2})(?::\d{2})?$').firstMatch(s);
    if (match != null) {
      int hour = int.tryParse(match.group(1)!) ?? 0;
      final min = match.group(2)!;
      final period = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour == 0) hour = 12;
      return '$hour:$min $period';
    }
    return s;
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppLanguage().tr(mr: '$label कॉपी केले', en: '$label copied to clipboard')),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF007A4D),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final s = status.toUpperCase();
    Color bg;
    Color text;
    Color border;
    String label;

    if (s.contains('NEW') || s.contains('CONFIRMED')) {
      bg = const Color(0xFFE0F2FE);
      text = const Color(0xFF0369A1);
      border = const Color(0xFFBAE6FD);
      label = AppLanguage().tr(mr: 'नवीन', en: 'New');
    } else if (s.contains('ACCEPT')) {
      bg = const Color(0xFFD1FAE5);
      text = const Color(0xFF065F46);
      border = const Color(0xFFA7F3D0);
      label = AppLanguage().tr(mr: 'स्वीकारले', en: 'Accepted');
    } else if (s.contains('PREPAR') || s.contains('PACK')) {
      bg = const Color(0xFFDBEAFE);
      text = const Color(0xFF1E40AF);
      border = const Color(0xFFBFDBFE);
      label = AppLanguage().tr(mr: 'तयारी सुरू', en: 'Preparing');
    } else if (s.contains('READY')) {
      bg = const Color(0xFFE0E7FF);
      text = const Color(0xFF3730A3);
      border = const Color(0xFFC7D2FE);
      label = AppLanguage().tr(mr: 'पिकअपसाठी तयार', en: 'Ready for Pickup');
    } else if (s.contains('COMPLET') || s.contains('DELIVER') || s.contains('PAID')) {
      bg = const Color(0xFFD1FAE5);
      text = const Color(0xFF065F46);
      border = const Color(0xFFA7F3D0);
      label = AppLanguage().tr(mr: 'पूर्ण', en: 'Completed');
    } else if (s.contains('REJECT') || s.contains('CANCEL')) {
      bg = const Color(0xFFFEE2E2);
      text = const Color(0xFF991B1B);
      border = const Color(0xFFFECACA);
      label = AppLanguage().tr(mr: 'नाकारले', en: 'Rejected');
    } else {
      bg = const Color(0xFFF3F4F6);
      text = const Color(0xFF374151);
      border = const Color(0xFFE5E7EB);
      label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: text),
      ),
    );
  }

  Widget _buildVendorDetailsCard(FarmerOrderItem order, FarmerProfile profile) {
    final vBusiness = order.vendorBusinessName.isNotEmpty
        ? order.vendorBusinessName
        : (profile.vendorName.isNotEmpty ? profile.vendorName : order.vendorName);
    final vName = order.vendorOwnerName.isNotEmpty
        ? order.vendorOwnerName
        : (order.vendorName.isNotEmpty ? order.vendorName : vBusiness);
    final vCode = order.vendorCode.isNotEmpty
        ? order.vendorCode
        : (order.vendorId.isNotEmpty ? order.vendorId : profile.vendorId);
    final vPhone = order.vendorPhone.isNotEmpty ? order.vendorPhone : '';
    final vAddress = order.vendorAddress.isNotEmpty ? order.vendorAddress : '';
    final vEmail = order.vendorEmail.isNotEmpty ? order.vendorEmail : '';

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF86EFAC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16A34A).withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            color: const Color(0xFFF0FDF4),
            child: Row(
              children: [
                const Icon(Icons.verified_rounded, size: 16, color: Color(0xFF16A34A)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    AppLanguage().tr(
                      mr: 'ऑर्डर पाठवणारा अधिकृत व्हेंडर (Vendor)',
                      en: 'Order Placed by Assigned Vendor',
                    ),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF166534),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                  ),
                  child: Text(
                    AppLanguage().tr(mr: 'अधिकृत', en: 'Verified'),
                    style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF15803D),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFDCFCE7)),

          // Body Content
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFBBF7D0)),
                      ),
                      child: const Icon(
                        Icons.storefront_rounded,
                        color: Color(0xFF16A34A),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            vBusiness.isNotEmpty ? vBusiness : AppLanguage().tr(mr: 'अधिकृत व्हेंडर', en: 'Assigned Vendor'),
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1F2937),
                            ),
                          ),
                          if (vName.isNotEmpty && vName != vBusiness) ...[
                            const SizedBox(height: 2),
                            Text(
                              AppLanguage().tr(mr: 'मालक / संपर्क: $vName', en: 'Owner / Contact: $vName'),
                              style: const TextStyle(fontSize: 12, color: Color(0xFF4B5563), fontWeight: FontWeight.w500),
                            ),
                          ],
                          if (vCode.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            InkWell(
                              onTap: () => _copyToClipboard(vCode, AppLanguage().tr(mr: 'व्हेंडर कोड', en: 'Vendor Code')),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'ID: $vCode',
                                    style: const TextStyle(
                                      fontFamily: 'monospace',
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF059669),
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.copy_rounded, size: 11, color: Color(0xFF059669)),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),

                if (vPhone.trim().isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.phone_rounded, size: 15, color: Color(0xFF16A34A)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            vPhone,
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                          ),
                        ),
                        InkWell(
                          onTap: () {
                            final clean = vPhone.replaceAll(RegExp(r'\D'), '');
                            if (clean.isNotEmpty) {
                              launchUrl(Uri.parse('tel:$clean'), mode: LaunchMode.externalApplication);
                            }
                          },
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF16A34A),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.call, size: 12, color: Colors.white),
                                const SizedBox(width: 4),
                                Text(
                                  AppLanguage().tr(mr: 'कॉल करा', en: 'Call'),
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                if (vAddress.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF6B7280)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          vAddress,
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563)),
                        ),
                      ),
                    ],
                  ),
                ],

                if (vEmail.trim().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.email_outlined, size: 14, color: Color(0xFF6B7280)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          vEmail,
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF4B5563)),
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 13, color: Color(0xFF15803D)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          AppLanguage().tr(
                            mr: 'शेतकऱ्याला ऑर्डर फक्त त्याचा नियुक्त व्हेंडरच पाठवू शकतो. ही ऑर्डर या अधिकृत व्हेंडरकडून पाठवण्यात आली आहे.',
                            en: 'Only your assigned vendor can send orders to you. This order was sent by this verified vendor.',
                          ),
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF166534), fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRejectionNotice(FarmerOrderItem order) {
    if (order.rejectedQuantity <= 0 && order.rejectionReason.isEmpty && order.rejectionNote.isEmpty) {
      return const SizedBox.shrink();
    }
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, size: 22, color: Color(0xFFDC2626)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLanguage().tr(mr: 'नाकारलेला तपशील', en: 'Rejection Details'),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                ),
                if (order.rejectedQuantity > 0) ...[
                  const SizedBox(height: 2),
                  Text(
                    AppLanguage().tr(
                      mr: 'नाकारलेले प्रमाण: ${order.rejectedQuantity.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)}',
                      en: 'Rejected Qty: ${order.rejectedQuantity.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)}',
                    ),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFB91C1C)),
                  ),
                ],
                if (order.rejectionReason.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    AppLanguage().tr(mr: 'कारण: ${order.rejectionReason}', en: 'Reason: ${order.rejectionReason}'),
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF7F1D1D)),
                  ),
                ],
                if (order.rejectionNote.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    AppLanguage().tr(mr: 'टीप: ${order.rejectionNote}', en: 'Note: ${order.rejectionNote}'),
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF7F1D1D)),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogisticsCard(FarmerOrderItem order) {
    if (order.isDriverAssigned) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFBBF7D0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                  ),
                  child: const Icon(
                    Icons.sports_motorsports_rounded,
                    color: Color(0xFF16A34A),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            order.driverName.isNotEmpty
                                ? order.driverName
                                : AppLanguage().tr(mr: 'असाइन केलेला ड्रायव्हर', en: 'Assigned Driver'),
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF14532D),
                            ),
                          ),
                          if (order.driverStatus.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFF86EFAC)),
                              ),
                              child: Text(
                                order.driverStatus,
                                style: const TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF15803D),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        order.vehicleNumber.isNotEmpty
                            ? AppLanguage().tr(mr: 'वाहन: ${order.vehicleNumber} • ${order.driverPhone.isNotEmpty ? order.driverPhone : "ड्रायव्हर"}', en: 'Vehicle: ${order.vehicleNumber} • ${order.driverPhone.isNotEmpty ? order.driverPhone : "Driver"}')
                            : (order.driverPhone.isNotEmpty ? '📞 ${order.driverPhone}' : AppLanguage().tr(mr: 'ड्रायव्हर असाइन केला आहे', en: 'Driver Assigned')),
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF166534),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                if (order.driverPhone.trim().isNotEmpty)
                  IconButton(
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.all(8),
                    ),
                    icon: const Icon(Icons.phone_rounded, size: 16),
                    tooltip: AppLanguage().tr(mr: 'ड्रायव्हरला कॉल करा', en: 'Call Driver'),
                    onPressed: () {
                      final clean = order.driverPhone.replaceAll(RegExp(r'\D'), '');
                      if (clean.isNotEmpty) {
                        launchUrl(Uri.parse('tel:$clean'), mode: LaunchMode.externalApplication);
                      }
                    },
                  ),
              ],
            ),
            if (order.collectionCentre.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFDCFCE7)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.hub_outlined, size: 14, color: Color(0xFF166534)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        AppLanguage().tr(mr: 'संकलन केंद्र: ${order.collectionCentre}', en: 'Collection Centre: ${order.collectionCentre}'),
                        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF14532D)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      );
    } else {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            const Icon(Icons.local_shipping_outlined, size: 20, color: Color(0xFF9CA3AF)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppLanguage().tr(mr: 'वाहन व वाहतूक (Logistics)', en: 'Logistics & Transport'),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF374151)),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    AppLanguage().tr(mr: 'पिकअपसाठी वाहन व ड्रायव्हर लवकरच नियुक्त केला जाईल.', en: 'Driver will be assigned soon for pickup.'),
                    style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }
  }

  Widget _buildTimelineCard(FarmerOrderItem order) {
    final s = order.status.toUpperCase();
    final steps = [
      {
        'title': AppLanguage().tr(mr: 'ऑर्डर पाठवली (व्हेंडर)', en: 'Order Placed (Vendor)'),
        'desc': AppLanguage().tr(
          mr: order.vendorBusinessName.isNotEmpty
              ? '${order.vendorBusinessName} कडून नवीन ऑर्डर आली'
              : (order.vendorName.isNotEmpty ? '${order.vendorName} कडून ऑर्डर आली' : 'अधिकृत व्हेंडरकडून ऑर्डर पाठवण्यात आली'),
          en: 'Order sent by assigned vendor',
        ),
        'time': order.createdAt,
        'done': true,
        'current': s.contains('NEW') || s.contains('CONFIRMED'),
      },
      {
        'title': AppLanguage().tr(mr: 'ऑर्डर स्वीकारली', en: 'Order Accepted'),
        'desc': AppLanguage().tr(mr: 'शेतकऱ्याने ऑर्डर स्वीकारली आहे', en: 'Order accepted by farmer'),
        'time': order.acceptedAt,
        'done': !s.contains('NEW') && !s.contains('CONFIRMED') && !s.contains('REJECT') && !s.contains('CANCEL'),
        'current': s.contains('ACCEPT'),
      },
      {
        'title': AppLanguage().tr(mr: 'काढणी व पॅकिंग', en: 'Harvest & Packing'),
        'desc': AppLanguage().tr(mr: 'शेतमालाची पॅकिंग व प्रतवारी तयारी', en: 'Preparing and grading produce'),
        'time': order.preparedAt,
        'done': s.contains('PREPAR') || s.contains('PACK') || s.contains('READY') || s.contains('COMPLET') || s.contains('DELIVER') || s.contains('PAID'),
        'current': s.contains('PREPAR') || s.contains('PACK'),
      },
      {
        'title': AppLanguage().tr(mr: 'पिकअपसाठी तयार', en: 'Ready for Pickup'),
        'desc': AppLanguage().tr(mr: 'वाहन उचलीसाठी माल शेतावर तयार आहे', en: 'Produce ready for vehicle pickup'),
        'time': order.readyForPickupAt,
        'done': s.contains('READY') || s.contains('COMPLET') || s.contains('DELIVER') || s.contains('PAID'),
        'current': s.contains('READY'),
      },
      {
        'title': AppLanguage().tr(mr: 'पूर्ण / पोहोचले', en: 'Completed'),
        'desc': AppLanguage().tr(mr: 'संकलन केंद्रात माल जमा व हिशेब पूर्ण', en: 'Received and settled at centre'),
        'time': '',
        'done': s.contains('COMPLET') || s.contains('DELIVER') || s.contains('PAID'),
        'current': s.contains('COMPLET') || s.contains('DELIVER') || s.contains('PAID'),
      },
    ];

    final isRejected = s.contains('REJECT') || s.contains('CANCEL');

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.history_rounded, size: 18, color: Color(0xFF217346)),
              const SizedBox(width: 8),
              Text(
                AppLanguage().tr(mr: 'ऑर्डर स्थिती व इतिहास', en: 'Order Status & History'),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (isRejected) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.cancel_rounded, color: Color(0xFFDC2626), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AppLanguage().tr(mr: 'ऑर्डर नाकारली गेली आहे', en: 'Order Rejected'),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                        ),
                        if (order.rejectionReason.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            AppLanguage().tr(mr: 'कारण: ${order.rejectionReason}', en: 'Reason: ${order.rejectionReason}'),
                            style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), fontWeight: FontWeight.w500),
                          ),
                        ],
                        if (order.rejectionNote.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            AppLanguage().tr(mr: 'टीप: ${order.rejectionNote}', en: 'Note: ${order.rejectionNote}'),
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF7F1D1D)),
                          ),
                        ],
                        if (order.rejectedBy.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            AppLanguage().tr(mr: 'कोणी नाकारले: ${order.rejectedBy}', en: 'Rejected by: ${order.rejectedBy}'),
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF7F1D1D), fontWeight: FontWeight.w500),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: steps.length,
              itemBuilder: (context, i) {
                final step = steps[i];
                final isDone = step['done'] as bool;
                final isCurr = step['current'] as bool;
                final isLast = i == steps.length - 1;

                Color iconColor = isDone ? const Color(0xFF16A34A) : const Color(0xFFD1D5DB);
                Color iconBg = isDone ? const Color(0xFFDCFCE7) : const Color(0xFFF3F4F6);
                Color lineCol = isDone ? const Color(0xFF86EFAC) : const Color(0xFFE5E7EB);

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: iconBg,
                              shape: BoxShape.circle,
                              border: Border.all(color: iconColor, width: 2),
                            ),
                            child: Center(
                              child: isDone
                                  ? Icon(Icons.check, size: 12, color: iconColor)
                                  : Container(
                                      width: 6,
                                      height: 6,
                                      decoration: BoxDecoration(
                                        color: iconColor,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                            ),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                width: 2,
                                color: lineCol,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    step['title'] as String,
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: isCurr || isDone ? FontWeight.bold : FontWeight.w500,
                                      color: isDone ? const Color(0xFF1F2937) : const Color(0xFF9CA3AF),
                                    ),
                                  ),
                                  if ((step['time'] as String).isNotEmpty)
                                    Text(
                                      _shortDate(step['time'] as String),
                                      style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                step['desc'] as String,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  void _showAcceptDialog(FarmerOrderItem order) {
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppLanguage().tr(mr: 'ऑर्डर स्वीकारायची?', en: 'Accept order?'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Text(
          AppLanguage().tr(mr: '${order.productName} ची ही ऑर्डर (${order.quantity.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)}) स्वीकारायची आहे का?', en: 'Confirm acceptance of this ${order.productName} order (${order.quantity.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)})?'),
          style: const TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(AppLanguage().tr(mr: 'रद्द करा', en: 'Cancel'), style: TextStyle(color: AppColors.muted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF007A4D),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() => _isBusy = true);
              try {
                await FarmerState().acceptOrder(order.id);
                if (!mounted) return;
                messenger.showSnackBar(
                  SnackBar(
                    content: Text(AppLanguage().tr(mr: 'तुम्ही ${order.quantity.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)} ${order.productName} ची ऑर्डर स्वीकारली आहे', en: 'You accepted the order for ${order.quantity.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)} ${order.productName}')),
                    backgroundColor: const Color(0xFF007A4D),
                  ),
                );
                nav.pushReplacement(
                  MaterialPageRoute(
                    builder: (_) => OrderPrepareScreen(orderId: order.id),
                  ),
                );
              } catch (e) {
                if (!mounted) return;
                messenger.showSnackBar(
                  SnackBar(content: Text(AppLanguage().tr(mr: 'त्रुटी: $e', en: 'Error: $e')), backgroundColor: AppColors.error),
                );
              } finally {
                if (mounted) setState(() => _isBusy = false);
              }
            },
            child: Text(AppLanguage().tr(mr: 'स्वीकारा', en: 'Confirm Accept')),
          ),
        ],
      ),
    );
  }

  void _showRejectDialog(FarmerOrderItem order) {
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    String selectedReason = 'Stock Unavailable';
    final reasons = [
      'Stock Unavailable',
      'Quality Issue',
      'Pickup Issue',
      'Quantity Mismatch',
      'Other',
    ];
    final noteController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(AppLanguage().tr(mr: 'ऑर्डर नाकारा', en: 'Reject Order'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(AppLanguage().tr(mr: 'नाकारण्याचे कारण *', en: 'Rejection reason *'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFD4D4D4)),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: selectedReason,
                      items: reasons.map((r) => DropdownMenuItem(value: r, child: Text(AppLanguage().pick(r), style: const TextStyle(fontSize: 13)))).toList(),
                      onChanged: (val) {
                        if (val != null) setDialogState(() => selectedReason = val);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  selectedReason == 'Other' ? AppLanguage().tr(mr: 'इतर कारण *', en: 'Other reason *') : AppLanguage().tr(mr: 'टीप (ऐच्छिक)', en: 'Optional note'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: noteController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: selectedReason == 'Other' ? AppLanguage().tr(mr: 'कारण लिहा...', en: 'Enter the reason...') : AppLanguage().tr(mr: 'अधिक माहिती लिहा...', en: 'Add any additional note...'),
                    hintStyle: const TextStyle(fontSize: 12, color: AppColors.muted),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.all(10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFFD4D4D4))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFFD4D4D4))),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(AppLanguage().tr(mr: 'रद्द करा', en: 'Cancel'), style: TextStyle(color: AppColors.muted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                if (selectedReason == 'Other' && noteController.text.trim().isEmpty) {
                  messenger.showSnackBar(
                    SnackBar(content: Text(AppLanguage().tr(mr: 'कृपया इतर कारण लिहा', en: 'Please enter the other reason'))),
                  );
                  return;
                }
                Navigator.pop(ctx);
                setState(() => _isBusy = true);
                try {
                  await FarmerState().rejectOrder(
                    order.id,
                    reason: selectedReason,
                    note: noteController.text.trim(),
                  );
                  if (!mounted) return;
                  messenger.showSnackBar(
                    SnackBar(content: Text(AppLanguage().tr(mr: 'ऑर्डर नाकारली', en: 'Order rejected')), backgroundColor: Color(0xFFDC2626)),
                  );
                  nav.pop();
                } catch (e) {
                  if (!mounted) return;
                  messenger.showSnackBar(
                    SnackBar(content: Text(AppLanguage().tr(mr: 'त्रुटी: $e', en: 'Error: $e')), backgroundColor: AppColors.error),
                  );
                } finally {
                  if (mounted) setState(() => _isBusy = false);
                }
              },
              child: Text(AppLanguage().tr(mr: 'नाकारा', en: 'Confirm Reject')),
            ),
          ],
        ),
      ),
    );
  }

  String _formatProductBusinessCode(FarmerOrderItem order) {
    if (order.productId.isNotEmpty) return order.productId;
    final cleanName = order.productName.split(' ')[0].replaceAll(RegExp(r'[^a-zA-Z]'), '').toUpperCase();
    final cleanVar = order.variety.split(' ')[0].replaceAll(RegExp(r'[^a-zA-Z]'), '').toUpperCase();
    if (cleanName.isEmpty && cleanVar.isEmpty) return order.orderCode;
    final nameCode = cleanName.length >= 3 ? cleanName.substring(0, 3) : (cleanName.isNotEmpty ? cleanName : 'PRD');
    final varCode = cleanVar.length >= 3 ? cleanVar.substring(0, 3) : (cleanVar.isNotEmpty ? cleanVar : 'VAR');
    final numDigits = order.id.replaceAll(RegExp(r'[^0-9]'), '');
    final serial = numDigits.isNotEmpty ? numDigits.padLeft(5, '0') : '00000';
    final tail = serial.length > 5 ? serial.substring(serial.length - 5) : serial;
    return 'GGC-ART-VEG-$nameCode-$varCode-$tail';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: FarmerState(),
      builder: (context, _) {
        final orders = FarmerState().orders;
        final profile = FarmerState().profile;
        final order = orders.firstWhere(
          (o) => o.id == widget.orderId || o.orderCode == widget.orderId,
          orElse: () => FarmerOrderItem(
            id: widget.orderId,
            orderCode: widget.orderId,
            buyerName: '',
            buyerPhone: '',
            productName: '',
            variety: '',
            quantity: 0,
            unit: '',
            totalAmount: 0,
            status: '',
            pickupDate: '',
            pickupSlot: '',
            createdAt: '',
          ),
        );

        final s = order.status.toUpperCase();
        final canAccept = s.contains('NEW') || s.contains('CONFIRMED');
        final canReject = s.contains('NEW') || s.contains('CONFIRMED');
        final canPrepare = s.contains('ACCEPT') || s.contains('PREPAR') || s.contains('PACK');

        // Dynamic Grades rows matching web screenshot
        final grades = [
          if (order.gradeAQty > 0)
            {
              'grade': 'Grade A',
              'qty': order.gradeAQty,
              'rate': order.gradeARate > 0 ? order.gradeARate : order.rate,
              'amount': order.gradeAQty * (order.gradeARate > 0 ? order.gradeARate : order.rate),
            },
          if (order.gradeBQty > 0)
            {
              'grade': 'Grade B',
              'qty': order.gradeBQty,
              'rate': order.gradeBRate > 0 ? order.gradeBRate : ((order.rate * 0.4).roundToDouble() > 0 ? (order.rate * 0.4).roundToDouble() : 5.0),
              'amount': order.gradeBQty * (order.gradeBRate > 0 ? order.gradeBRate : ((order.rate * 0.4).roundToDouble() > 0 ? (order.rate * 0.4).roundToDouble() : 5.0)),
            },
          if (order.gradeCQty > 0)
            {
              'grade': 'Grade C',
              'qty': order.gradeCQty,
              'rate': order.gradeCRate > 0 ? order.gradeCRate : 2.0,
              'amount': order.gradeCQty * (order.gradeCRate > 0 ? order.gradeCRate : 2.0),
            },
        ];

        final double calculatedTotal = grades.fold(0.0, (sum, g) => sum + (g['amount'] as double));
        final double finalOrderValue = order.totalAmount > 0 ? order.totalAmount : calculatedTotal;
        final productBizId = _formatProductBusinessCode(order);
        final qrPayload = 'greengrocc:order:${order.orderCode}';
        final farmerDisplayName = profile.fullName;

        return Scaffold(
          backgroundColor: const Color(0xFFF9FAFB),
          body: SafeArea(
            child: RefreshIndicator(
              color: const Color(0xFF217346),
              onRefresh: () => FarmerState().refreshOrders(),
              child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Status Badge & Back Link
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      InkWell(
                        onTap: () => Navigator.pop(context),
                        borderRadius: BorderRadius.circular(4),
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 4),
                          child: Text(
                            AppLanguage().tr(mr: '← ऑर्डर्स', en: '← Orders'),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF217346),
                            ),
                          ),
                        ),
                      ),
                      _buildStatusBadge(order.status),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Heading: Big Product Title
                  Text(
                    order.productName,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1F2937),
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 4),

                  // Order ID with copy icon
                  InkWell(
                    onTap: () => _copyToClipboard(order.orderCode, AppLanguage().tr(mr: 'ऑर्डर क्रमांक', en: 'Order ID')),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          order.orderCode,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.copy_rounded, size: 14, color: Color(0xFF6B7280)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Card 1: Assigned Vendor Card (Order Sender Info)
                  _buildVendorDetailsCard(order, profile),
                  const SizedBox(height: 12),

                  // Card 2: Product Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AppLanguage().tr(mr: 'उत्पादन', en: 'Product'),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1F2937),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          order.productName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1F2937),
                          ),
                        ),
                        if (order.variety.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            AppLanguage().tr(mr: 'वाण: ${AppLanguage().pick(order.variety)}', en: 'Variety: ${order.variety}'),
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () => _copyToClipboard(productBizId, AppLanguage().tr(mr: 'उत्पादन कोड', en: 'Product Code')),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                productBizId,
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF059669),
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Icon(Icons.copy_rounded, size: 13, color: Color(0xFF059669)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Card 3: 6-Fact Schedule Grid (Order date, Pickup date, Pickup time, Total qty, Payment, Delivery)
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 2.1,
                    children: [
                      _FactBox(label: AppLanguage().tr(mr: 'ऑर्डर तारीख', en: 'Order date'), value: _shortDate(order.createdAt)),
                      _FactBox(label: AppLanguage().tr(mr: 'पिकअप तारीख', en: 'Pickup date'), value: '${_shortDate(order.pickupDate)}${order.day.isNotEmpty ? " (${order.day})" : ""}'),
                      _FactBox(label: AppLanguage().tr(mr: 'पिकअप वेळ', en: 'Pickup time'), value: _formatTime12h(order.pickupSlot)),
                      _FactBox(label: AppLanguage().tr(mr: 'एकूण प्रमाण', en: 'Total qty'), value: '${order.quantity.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)}'),
                      _FactBox(label: AppLanguage().tr(mr: 'पेमेंट स्थिती', en: 'Payment'), value: order.paymentStatus.isNotEmpty ? order.paymentStatus : 'Pending'),
                      _FactBox(label: AppLanguage().tr(mr: 'डिलिव्हरी स्थिती', en: 'Delivery'), value: order.deliveryStatus.isNotEmpty ? order.deliveryStatus : 'Pending'),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Card 2: Grades Table Card
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Text(
                            AppLanguage().tr(mr: 'ग्रेड', en: 'Grades'),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1F2937),
                            ),
                          ),
                        ),
                        // Table Header
                        Container(
                          color: const Color(0xFFF8FAF8),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          child: Row(
                            children: [
                              Expanded(flex: 3, child: Text(AppLanguage().tr(mr: 'ग्रेड', en: 'Grade'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF6B7280)))),
                              Expanded(flex: 2, child: Text(AppLanguage().tr(mr: 'प्रमाण', en: 'Qty'), textAlign: TextAlign.right, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF6B7280)))),
                              Expanded(flex: 2, child: Text(AppLanguage().tr(mr: 'दर', en: 'Rate'), textAlign: TextAlign.right, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF6B7280)))),
                              Expanded(flex: 3, child: Text(AppLanguage().tr(mr: 'रक्कम', en: 'Amount'), textAlign: TextAlign.right, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF6B7280)))),
                            ],
                          ),
                        ),
                        const Divider(height: 1, color: Color(0xFFF3F4F6)),

                        // Table Rows
                        ...grades.map((g) {
                          final label = AppLanguage().pick(g['grade'] as String);
                          final qty = g['qty'] as double;
                          final rate = g['rate'] as double;
                          final amt = g['amount'] as double;

                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                            decoration: const BoxDecoration(
                              border: Border(bottom: BorderSide(color: Color(0xFFF3F4F6), width: 1)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: Text(
                                    label,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1F2937)),
                                  ),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text(
                                    '${qty.toStringAsFixed(0)} ${AppLanguage().pick(order.unit)}',
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                                  ),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text(
                                    '₹${rate.toStringAsFixed(0)}/${AppLanguage().pick(order.unit)}',
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                                  ),
                                ),
                                Expanded(
                                  flex: 3,
                                  child: Text(
                                    '₹${amt.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),

                        // Table Footer (Order value)
                        Container(
                          color: const Color(0xFFF8FAF8),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                AppLanguage().tr(mr: 'ऑर्डर मूल्य', en: 'Order value'),
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF6B7280)),
                              ),
                              Text(
                                '₹${finalOrderValue.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Rejection Notice (if any)
                  _buildRejectionNotice(order),

                  // Card 5: Logistics & Driver Card
                  _buildLogisticsCard(order),
                  const SizedBox(height: 12),

                  // Card 6: Order Lifecycle Timeline
                  _buildTimelineCard(order),
                  const SizedBox(height: 14),

                  // Card 7: Order QR Card (Matching Screenshot 2)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AppLanguage().tr(mr: 'ऑर्डर QR', en: 'Order QR'),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1F2937),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              // QR Code Image
                              Container(
                                width: 175,
                                height: 175,
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  border: Border.all(color: const Color(0xFFE5E7EB)),
                                ),
                                child: Image.network(
                                  'https://api.qrserver.com/v1/create-qr-code/?size=220x220&ecc=M&data=${Uri.encodeComponent(qrPayload)}',
                                  width: 165,
                                  height: 165,
                                  fit: BoxFit.contain,
                                  loadingBuilder: (context, child, progress) {
                                    if (progress == null) return child;
                                    return const Center(
                                      child: SizedBox(
                                        width: 28,
                                        height: 28,
                                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF217346)),
                                      ),
                                    );
                                  },
                                  errorBuilder: (context, error, stackTrace) => const Center(
                                    child: Icon(Icons.qr_code_2_rounded, size: 140, color: Color(0xFF1F2937)),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                qrPayload,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF4B5563),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '$farmerDisplayName · ${order.productName}${order.variety.isNotEmpty ? " · ${order.variety}" : ""}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                AppLanguage().tr(mr: 'संपूर्ण ऑर्डर पाहण्यासाठी स्कॅन करा', en: 'Scan to view full order'),
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF9CA3AF),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Stacked Action Buttons (Matching Screenshot 2)
                  if (canAccept) ...[
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF007A4D),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        onPressed: _isBusy ? null : () => _showAcceptDialog(order),
                        child: Text(AppLanguage().tr(mr: 'स्वीकारा', en: 'Accept'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  if (canPrepare) ...[
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF007A4D),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => OrderPrepareScreen(orderId: order.id),
                            ),
                          );
                        },
                        child: Text(AppLanguage().tr(mr: 'तयारी करा', en: 'Prepare'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  if (canReject) ...[
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        onPressed: _isBusy ? null : () => _showRejectDialog(order),
                        child: Text(AppLanguage().tr(mr: 'नाकारा', en: 'Reject'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0F172A),
                        side: const BorderSide(color: Color(0xFFD1D5DB)),
                        backgroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: Text(AppLanguage().tr(mr: 'मागे', en: 'Back'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
            ),
          ),
        );
      },
    );
  }
}

class _FactBox extends StatelessWidget {
  final String label;
  final String value;

  const _FactBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAF8),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF6B7280)),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
          ),
        ],
      ),
    );
  }
}
