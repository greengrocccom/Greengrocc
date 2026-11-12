import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../config/constants.dart';
import '../../config/contact.dart';
import '../../core/utils/address_utils.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/order_number.dart';
import '../../core/utils/order_utils.dart';
import '../../core/utils/payment_utils.dart';
import '../../models/order.dart';
import '../../models/user.dart';

String getInvoicePaymentStatusLabel(Order order) {
  if (order.paymentStatus == 'paid_10') return '10% Paid';
  return getOrderPaymentLabel(order);
}

Future<Uint8List> generateInvoicePdf(
  Order order, {
  User? user,
}) async {
  final doc = pw.Document();
  final orderNo = getOrderNumber(order);
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

  pw.MemoryImage? logo;
  try {
    final logoData = await rootBundle.load(AppConstants.wordmarkLogoAsset);
    logo = pw.MemoryImage(logoData.buffer.asUint8List());
  } catch (_) {
    logo = null;
  }

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(28),
      build: (context) => [
        pw.Container(
          width: double.infinity,
          color: const PdfColor.fromInt(0xFF0F172A),
          padding: const pw.EdgeInsets.all(16),
          child: pw.Column(
            children: [
              if (logo != null)
                pw.Container(
                  padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: pw.BoxDecoration(
                    color: PdfColors.white,
                    borderRadius: pw.BorderRadius.circular(8),
                  ),
                  child: pw.Image(logo, height: 40, fit: pw.BoxFit.contain),
                )
              else
                pw.Text(
                  'GreenGrocc',
                  style: pw.TextStyle(
                    color: PdfColors.white,
                    fontSize: 22,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
              pw.SizedBox(height: 8),
              pw.Text(
                '${ContactConfig.contactAddress}, Mumbai, Maharashtra',
                style: const pw.TextStyle(color: PdfColors.grey300, fontSize: 9),
              ),
              pw.SizedBox(height: 2),
              pw.Text(
                'Phone: ${ContactConfig.contactPhoneDisplay} | Email: ${ContactConfig.contactEmail}',
                style: const pw.TextStyle(color: PdfColors.grey300, fontSize: 9),
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 16),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Expanded(child: _pdfInfoBox('INVOICE & ORDER', [
              ['Invoice Date', formatOrderDate(DateTime.now())],
              ['Order No', orderNo],
              ['Invoice No', '$orderNo-INV'],
              ['Order Date', formatOrderDate(order.createdAt)],
              ['Order Status', getOrderStatusLabel(order.status)],
              ['Payment Status', paymentStatus],
              ['Payment Mode', paymentMode],
            ])),
            pw.SizedBox(width: 12),
            pw.Expanded(child: _pdfInfoBox('BILL TO', [
              ['Name', getAddressFullName(addr).isNotEmpty ? getAddressFullName(addr) : (user?.name ?? '—')],
              ['Email', addr.email.isNotEmpty ? addr.email : (user?.email ?? '—')],
              [
                'Phone',
                addr.number.isNotEmpty
                    ? '+91 ${addr.number}'
                    : (user?.phone.isNotEmpty == true ? '+91 ${user!.phone}' : '—'),
              ],
              ['Shop', addr.shopName.isNotEmpty ? addr.shopName : '—'],
              ['Address', addr.fullAddress.isNotEmpty ? addr.fullAddress : formatAddressLine(addr)],
            ])),
          ],
        ),
        pw.SizedBox(height: 16),
        pw.TableHelper.fromTextArray(
          headers: const ['Sr', 'Item', 'Qty', 'Rate', 'Amount'],
          data: [
            for (var i = 0; i < order.items.length; i++)
              [
                '${i + 1}',
                order.items[i].name,
                '${order.items[i].quantity}',
                formatInr(order.items[i].price),
                formatInr(order.items[i].price * order.items[i].quantity),
              ],
          ],
          headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
          cellStyle: const pw.TextStyle(fontSize: 9),
          headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
          cellAlignment: pw.Alignment.centerLeft,
          columnWidths: {
            0: const pw.FixedColumnWidth(24),
            2: const pw.FixedColumnWidth(32),
            3: const pw.FixedColumnWidth(56),
            4: const pw.FixedColumnWidth(56),
          },
        ),
        pw.SizedBox(height: 16),
        pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.SizedBox(
            width: 180,
            child: pw.Column(
              children: [
                _pdfTotalRow('Subtotal', formatInr(order.subtotal)),
                if (order.couponDiscount > 0)
                  _pdfTotalRow(
                    order.couponCode.isNotEmpty
                        ? 'Coupon (${order.couponCode})'
                        : 'Coupon Discount',
                    '-${formatInr(order.couponDiscount)}',
                  ),
                _pdfTotalRow(
                  'Delivery',
                  order.deliveryCharges == 0 ? 'Free' : formatInr(order.deliveryCharges),
                ),
                pw.Divider(),
                _pdfTotalRow('Total Amount', formatInr(order.total), bold: true),
                if (isAdvancePaid) ...[
                  _pdfTotalRow('Advance Paid (10%)', formatInr(advancePaid)),
                  _pdfTotalRow(
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
          pw.Padding(
            padding: const pw.EdgeInsets.only(top: 12),
            child: pw.Text(
              'Remarks: 10% advance amount of ${formatInr(advancePaid)} has been paid. '
              'Remaining balance of ${formatInr(remainingBalance)} is payable on delivery.',
              style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey800),
            ),
          ),
        pw.SizedBox(height: 20),
        pw.Divider(color: PdfColors.grey300),
        pw.Text(
          'For any queries about this order, call ${ContactConfig.contactPhoneDisplay} '
          'or email ${ContactConfig.contactEmail}.',
          style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey800),
        ),
        pw.SizedBox(height: 4),
        pw.Text(
          'This is a computer generated invoice and does not require a signature. '
          'Thank you for shopping with GreenGrocc!',
          style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
        ),
      ],
    ),
  );

  return doc.save();
}

pw.Widget _pdfInfoBox(String title, List<List<String>> rows) {
  return pw.Container(
    padding: const pw.EdgeInsets.all(10),
    decoration: pw.BoxDecoration(
      border: pw.Border.all(color: PdfColors.grey300),
      borderRadius: pw.BorderRadius.circular(4),
    ),
    child: pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
        pw.SizedBox(height: 8),
        for (final row in rows)
          pw.Padding(
            padding: const pw.EdgeInsets.only(bottom: 4),
            child: pw.Row(
              children: [
                pw.Expanded(
                  flex: 2,
                  child: pw.Text(row[0], style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                ),
                pw.Expanded(
                  flex: 3,
                  child: pw.Text(row[1], style: const pw.TextStyle(fontSize: 8), textAlign: pw.TextAlign.right),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

pw.Widget _pdfTotalRow(String label, String value, {bool bold = false}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 2),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label, style: pw.TextStyle(fontSize: 10, fontWeight: bold ? pw.FontWeight.bold : null)),
        pw.Text(value, style: pw.TextStyle(fontSize: 10, fontWeight: bold ? pw.FontWeight.bold : null)),
      ],
    ),
  );
}
