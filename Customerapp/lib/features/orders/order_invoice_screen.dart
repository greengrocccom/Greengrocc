import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../config/constants.dart';
import '../../config/contact.dart';
import '../../config/theme.dart';
import '../../core/providers/app_providers.dart';
import '../../core/utils/address_utils.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/invoice_pdf.dart';
import '../../core/utils/order_number.dart';
import '../../core/utils/order_utils.dart';
import '../../core/utils/payment_utils.dart';
import '../../features/auth/auth_controller.dart';
import '../../models/order.dart';
import '../../routes/route_paths.dart';
import '../../widgets/common/skeleton_loaders.dart';

class OrderInvoiceScreen extends ConsumerStatefulWidget {
  const OrderInvoiceScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderInvoiceScreen> createState() => _OrderInvoiceScreenState();
}

class _OrderInvoiceScreenState extends ConsumerState<OrderInvoiceScreen> {
  Order? _order;
  bool _loading = true;
  bool _downloadingPdf = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_loadOrder);
  }

  Future<void> _loadOrder() async {
    if (!ref.read(authControllerProvider).isLoggedIn) {
      setState(() => _loading = false);
      return;
    }

    try {
      final order = await ref.read(apiServiceProvider).fetchOrderById(widget.orderId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Order not found';
        _loading = false;
      });
    }
  }

  void _shareInvoice() {
    final order = _order;
    final user = ref.read(authControllerProvider).user;
    if (order == null) return;

    final orderNo = getOrderNumber(order);
    final addr = order.deliveryAddress;
    final buffer = StringBuffer()
      ..writeln('GreenGrocc Invoice')
      ..writeln('Order #$orderNo')
      ..writeln('Date: ${formatOrderDate(order.createdAt)}')
      ..writeln('Status: ${getOrderStatusLabel(order.status)}')
      ..writeln('Payment: ${getInvoicePaymentStatusLabel(order)}')
      ..writeln()
      ..writeln('Bill To: ${getAddressFullName(addr)}')
      ..writeln(formatAddressLine(addr))
      ..writeln('+91 ${addr.number}')
      ..writeln()
      ..writeln('Items:');

    for (var i = 0; i < order.items.length; i++) {
      final item = order.items[i];
      buffer.writeln(
        '${i + 1}. ${item.name} x${item.quantity} = ${formatInr(item.price * item.quantity)}',
      );
    }

    buffer
      ..writeln()
      ..writeln('Subtotal: ${formatInr(order.subtotal)}');
    if (order.couponDiscount > 0) {
      buffer.writeln(
        'Coupon Discount${order.couponCode.isNotEmpty ? ' (${order.couponCode})' : ''}: -${formatInr(order.couponDiscount)}',
      );
    }
    buffer
      ..writeln('Delivery: ${order.deliveryCharges == 0 ? 'Free' : formatInr(order.deliveryCharges)}')
      ..writeln('Total: ${formatInr(order.total)}')
      ..writeln()
      ..writeln('Thank you for shopping with GreenGrocc!')
      ..writeln('Phone: ${ContactConfig.contactPhoneDisplay}')
      ..writeln('Email: ${ContactConfig.contactEmail}');

    if (user != null) {
      buffer.writeln('Customer: ${user.name}');
    }

    SharePlus.instance.share(ShareParams(text: buffer.toString()));
  }

  Future<void> _downloadPdf() async {
    final order = _order;
    if (order == null || _downloadingPdf) return;

    setState(() => _downloadingPdf = true);
    try {
      final user = ref.read(authControllerProvider).user;
      final bytes = await generateInvoicePdf(order, user: user);
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/${getInvoiceFilename(order)}';
      final file = File(path);
      await file.writeAsBytes(bytes);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(path)],
          text: 'GreenGrocc Invoice #${getOrderNumber(order)}',
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to generate PDF')),
        );
      }
    } finally {
      if (mounted) setState(() => _downloadingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Bill Invoice')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('Please login to view invoice.'),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () => ref.read(authControllerProvider.notifier).openAuthModal(),
                  child: const Text('Login / Sign Up'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bill Invoice'),
        actions: [
          if (_order != null) ...[
            IconButton(
              onPressed: _downloadingPdf ? null : _downloadPdf,
              icon: _downloadingPdf
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.picture_as_pdf_outlined),
              tooltip: 'Download PDF',
            ),
            IconButton(
              onPressed: _shareInvoice,
              icon: const Icon(Icons.share_outlined),
              tooltip: 'Share invoice',
            ),
          ],
        ],
      ),
      body: _loading
          ? const SkeletonInvoicePage()
          : _error != null || _order == null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error ?? 'Order not found'),
                      TextButton(
                        onPressed: () => context.go(RoutePaths.orders),
                        child: const Text('← Back to My Orders'),
                      ),
                    ],
                  ),
                )
              : _InvoiceDocument(order: _order!, userName: auth.user?.name ?? ''),
    );
  }
}

class _InvoiceDocument extends StatelessWidget {
  const _InvoiceDocument({required this.order, required this.userName});

  final Order order;
  final String userName;

  @override
  Widget build(BuildContext context) {
    final orderNo = getOrderNumber(order);
    final invoiceNo = '$orderNo-INV';
    final addr = order.deliveryAddress;
    final paymentMode =
        order.paymentMethod == 'cod' ? 'Cash on Delivery' : 'Online Payment';
    final paymentStatus = getInvoicePaymentStatusLabel(order);
    final isAdvancePaid = order.paymentStatus == 'paid_10';
    final advancePaid = PaymentUtils.recordedAdvanceAmount(
      total: order.total,
      paymentStatus: order.paymentStatus,
      codAdvanceAmount: order.codAdvanceAmount,
    );
    final remainingBalance =
        isAdvancePaid ? (order.total - advancePaid).clamp(0.0, double.infinity) : 0.0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.borderLight),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              Container(
                width: double.infinity,
                color: const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Image.asset(
                        AppConstants.wordmarkLogoAsset,
                        height: 44,
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${ContactConfig.contactAddress}, Mumbai, Maharashtra',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Phone: ${ContactConfig.contactPhoneDisplay} | Email: ${ContactConfig.contactEmail}',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _infoBox(
                      title: 'Invoice & Order',
                      rows: [
                        ['Invoice Date', formatOrderDate(DateTime.now())],
                        ['Order No', orderNo],
                        ['Invoice No', invoiceNo],
                        ['Order Date', formatOrderDate(order.createdAt)],
                        ['Order Status', getOrderStatusLabel(order.status)],
                        ['Payment Status', paymentStatus],
                        ['Payment Mode', paymentMode],
                      ],
                    ),
                    const SizedBox(height: 12),
                    _infoBox(
                      title: 'Bill To',
                      rows: [
                        ['Name', getAddressFullName(addr).isNotEmpty ? getAddressFullName(addr) : userName],
                        ['Email', addr.email.isNotEmpty ? addr.email : '—'],
                        ['Phone', addr.number.isNotEmpty ? '+91 ${addr.number}' : '—'],
                        ['Shop', addr.shopName.isNotEmpty ? addr.shopName : '—'],
                        ['Shop No.', addr.shopNo.isNotEmpty ? addr.shopNo : '—'],
                        ['Address', addr.fullAddress.isNotEmpty ? addr.fullAddress : '—'],
                        ['Landmark', addr.landmark.isNotEmpty ? addr.landmark : '—'],
                        [
                          'City',
                          [addr.city, addr.state, addr.pincode]
                              .where((part) => part.isNotEmpty)
                              .join(', ')
                              .ifEmpty('—'),
                        ],
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.borderLight),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: const BoxDecoration(
                              color: AppColors.mobileSurface,
                              borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
                            ),
                            child: Row(
                              children: [
                                const SizedBox(
                                  width: 28,
                                  child: Text(
                                    'Sr',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10),
                                  ),
                                ),
                                const Expanded(
                                  child: Text(
                                    'Item Name',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                                  ),
                                ),
                                const SizedBox(
                                  width: 28,
                                  child: Text(
                                    'Qty',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10),
                                  ),
                                ),
                                const SizedBox(
                                  width: 52,
                                  child: Text(
                                    'Rate',
                                    textAlign: TextAlign.right,
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10),
                                  ),
                                ),
                                const SizedBox(
                                  width: 52,
                                  child: Text(
                                    'Amt',
                                    textAlign: TextAlign.right,
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          ...order.items.asMap().entries.map((entry) {
                            final index = entry.key;
                            final item = entry.value;
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                              decoration: const BoxDecoration(
                                border: Border(top: BorderSide(color: AppColors.borderLight)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    width: 28,
                                    child: Text(
                                      '${index + 1}',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(
                                      item.name,
                                      style: const TextStyle(fontSize: 11, height: 1.3),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 28,
                                    child: Text(
                                      '${item.quantity}',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 52,
                                    child: Text(
                                      formatInr(item.price),
                                      textAlign: TextAlign.right,
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                  ),
                                  SizedBox(
                                    width: 52,
                                    child: Text(
                                      formatInr(item.price * item.quantity),
                                      textAlign: TextAlign.right,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Align(
                      alignment: Alignment.centerRight,
                      child: SizedBox(
                        width: 220,
                        child: Column(
                          children: [
                            _totalRow('Subtotal', formatInr(order.subtotal)),
                            if (order.couponDiscount > 0)
                              _totalRow(
                                order.couponCode.isNotEmpty
                                    ? 'Coupon (${order.couponCode})'
                                    : 'Coupon Discount',
                                '-${formatInr(order.couponDiscount)}',
                              ),
                            _totalRow(
                              'Delivery',
                              order.deliveryCharges == 0 ? 'Free' : formatInr(order.deliveryCharges),
                            ),
                            const Divider(),
                            _totalRow('Grand Total', formatInr(order.total), bold: true),
                            if (isAdvancePaid) ...[
                              _totalRow('Advance Paid (10%)', formatInr(advancePaid)),
                              _totalRow(
                                'Balance Due on Delivery',
                                formatInr(remainingBalance),
                                bold: true,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    if (isAdvancePaid)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          'Remarks: 10% advance amount of ${formatInr(advancePaid)} has been paid. '
                          'Remaining balance of ${formatInr(remainingBalance)} is payable on delivery.',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.4,
                          ),
                        ),
                      ),
                    const SizedBox(height: 16),
                    const Divider(color: AppColors.borderLight),
                    const SizedBox(height: 8),
                    Text(
                      'For any queries about this order, call ${ContactConfig.contactPhoneDisplay} '
                      'or email ${ContactConfig.contactEmail}.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Thank you for shopping with GreenGrocc!',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _infoBox({required String title, required List<List<String>> rows}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 10),
          ...rows.map(
            (row) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(row[0], style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  ),
                  Expanded(
                    flex: 3,
                    child: Text(row[1], textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.w500, fontSize: 13)),
          Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.w500, fontSize: 13)),
        ],
      ),
    );
  }
}

extension _StringEmpty on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}
