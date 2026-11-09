import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../l10n/app_localizations.dart';

class OrderItemsScreen extends StatelessWidget {
  const OrderItemsScreen({
    super.key,
    required this.orderNumber,
    required this.items,
  });

  final String orderNumber;
  final List<dynamic> items;

  static const _forest = Color(0xFF126B43);
  static const _pageBg = Color(0xFFF3F6F4);

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final l10n = AppLocalizations.of(context);
    final totalQty = items.fold<int>(0, (sum, raw) {
      final item = raw is Map ? raw : <String, dynamic>{};
      return sum + ((item['quantity'] as num?)?.toInt() ?? 0);
    });

    return Scaffold(
      backgroundColor: _pageBg,
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(8, top + 6, 16, 18),
            decoration: const BoxDecoration(
              color: _forest,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(22)),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.delOrderItems,
                        style: GoogleFonts.inter(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        l10n.delOrderNumberItems(orderNumber, totalQty.toString()),
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? Center(
                    child: Text(
                      l10n.delNoItemsInOrder,
                      style: GoogleFonts.inter(color: const Color(0xFF6B7280)),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final raw = items[index];
                      final item = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
                      final name = (item['name'] ?? item['productName'] ?? l10n.delItemFallback).toString();
                      final qty = (item['quantity'] as num?)?.toInt() ?? 0;
                      final unit = (item['unit'] ?? '').toString().trim();
                      final price = (item['price'] as num?)?.toInt() ?? 0;
                      final imageUrl = _itemImageUrl(item);

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: SizedBox(
                                width: 56,
                                height: 56,
                                child: imageUrl != null
                                    ? Image.network(
                                        imageUrl,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, _, _) => _placeholderThumb(),
                                      )
                                    : _placeholderThumb(),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF111827),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    unit.isEmpty
                                        ? l10n.delQty(qty.toString())
                                        : l10n.delQtyWithUnit(qty.toString(), unit),
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: _forest,
                                    ),
                                  ),
                                  if (price > 0) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      '₹$price',
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: const Color(0xFF6B7280),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '×$qty',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: _forest,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  static String? _itemImageUrl(Map<String, dynamic> item) {
    for (final key in ['image', 'imageUrl', 'photo', 'thumbnail', 'productImage']) {
      final v = item[key]?.toString().trim() ?? '';
      if (v.startsWith('http')) return v;
    }
    return null;
  }

  static Widget _placeholderThumb() {
    return Container(
      color: const Color(0xFFF3F4F6),
      alignment: Alignment.center,
      child: const Icon(Icons.shopping_bag_outlined, color: Color(0xFF9CA3AF), size: 26),
    );
  }
}
