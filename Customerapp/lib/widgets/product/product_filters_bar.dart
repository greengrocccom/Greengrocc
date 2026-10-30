import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/utils/product_utils.dart';

/// Single-row horizontal product filter bar.
///
/// Order requested by user:
/// 1. Newest (by default first item)
/// 2. Discount
/// 3. Low to High (Price: Low to High)
/// 4. Price High to Low
/// 5. Oldest
/// 6. By Weight / Size
/// 7. Brand
/// 8. Pincode
/// 9. Full Filter Sheet
class ProductFiltersBar extends StatelessWidget {
  const ProductFiltersBar({
    super.key,
    required this.brands,
    required this.selectedBrand,
    required this.sortBy,
    this.selectedMinDiscount,
    this.selectedPincode,
    this.selectedWeightSize,
    this.weightsSizes = const [],
    this.inStockOnly = false,
    required this.onBrandChange,
    required this.onSortChange,
    this.onDiscountChange,
    this.onPincodeTap,
    this.onWeightSizeChange,
    this.onInStockOnlyChange,
    this.onOpenFilterSheet,
    this.onClear,
    this.hasActiveFilters = false,
    this.activeFiltersCount = 0,
    this.backgroundColor,
  });

  final List<String> brands;
  final String selectedBrand;
  final ProductSortOption sortBy;
  final String? selectedMinDiscount;
  final String? selectedPincode;
  final String? selectedWeightSize;
  final List<String> weightsSizes;
  final bool inStockOnly;
  final ValueChanged<String> onBrandChange;
  final ValueChanged<ProductSortOption> onSortChange;
  final ValueChanged<String?>? onDiscountChange;
  final VoidCallback? onPincodeTap;
  final ValueChanged<String?>? onWeightSizeChange;
  final ValueChanged<bool>? onInStockOnlyChange;
  final VoidCallback? onOpenFilterSheet;
  final VoidCallback? onClear;
  final bool hasActiveFilters;
  final int activeFiltersCount;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: backgroundColor ?? Colors.white,
        border: const Border(bottom: BorderSide(color: Color(0xFFF3F4F6))),
      ),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            // FILTERS (FULL SHEET BUTTON)
            if (onOpenFilterSheet != null) ...[
              InkWell(
                onTap: onOpenFilterSheet,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: hasActiveFilters
                        ? _brandGreen.withValues(alpha: 0.12)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: hasActiveFilters ? _brandGreen : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.tune_rounded,
                        size: 14,
                        color: hasActiveFilters ? _brandGreen : const Color(0xFF475569),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        activeFiltersCount > 0 ? 'Filters ($activeFiltersCount)' : 'Filters',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: hasActiveFilters ? _brandGreen : const Color(0xFF334155),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
            ],

            // 1. NEWEST
            _buildPillButton(
              icon: Icons.access_time_filled_rounded,
              label: 'Newest',
              isSelected: sortBy == ProductSortOption.newest ||
                  sortBy == ProductSortOption.listingDefault,
              onTap: () => onSortChange(ProductSortOption.newest),
            ),
            const SizedBox(width: 6),

            // 2. OLDEST
            _buildPillButton(
              icon: Icons.history_rounded,
              label: 'Oldest',
              isSelected: sortBy == ProductSortOption.oldest,
              onTap: () {
                if (sortBy == ProductSortOption.oldest) {
                  onSortChange(ProductSortOption.newest);
                } else {
                  onSortChange(ProductSortOption.oldest);
                }
              },
            ),
            const SizedBox(width: 6),

            // 3. DISCOUNT
            _buildDiscountPill(context),
            const SizedBox(width: 6),

            // 4. LOW TO HIGH
            _buildPillButton(
              icon: Icons.arrow_upward_rounded,
              label: 'Low to High',
              isSelected: sortBy == ProductSortOption.priceAsc,
              onTap: () {
                if (sortBy == ProductSortOption.priceAsc) {
                  onSortChange(ProductSortOption.newest);
                } else {
                  onSortChange(ProductSortOption.priceAsc);
                }
              },
            ),
            const SizedBox(width: 6),

            // 5. HIGH TO LOW
            _buildPillButton(
              icon: Icons.arrow_downward_rounded,
              label: 'Price High to Low',
              isSelected: sortBy == ProductSortOption.priceDesc,
              onTap: () {
                if (sortBy == ProductSortOption.priceDesc) {
                  onSortChange(ProductSortOption.newest);
                } else {
                  onSortChange(ProductSortOption.priceDesc);
                }
              },
            ),
            const SizedBox(width: 6),

            // 6. BY WEIGHT / SIZE
            _buildWeightSizePill(context),
            const SizedBox(width: 6),

            // 7. BRAND
            _buildBrandPill(context),
            const SizedBox(width: 6),

            // 8. PINCODE
            _buildPillButton(
              icon: Icons.location_on_outlined,
              label: selectedPincode?.isNotEmpty == true
                  ? 'Pin: $selectedPincode'
                  : 'Pincode',
              isSelected: selectedPincode?.isNotEmpty == true,
              showDropdownArrow: true,
              onTap: onPincodeTap ?? () {},
            ),

            // 9. IN-STOCK ONLY
            if (onInStockOnlyChange != null) ...[
              const SizedBox(width: 6),
              _buildPillButton(
                icon: inStockOnly
                    ? Icons.check_circle_rounded
                    : Icons.inventory_2_outlined,
                label: 'In Stock',
                isSelected: inStockOnly,
                onTap: () => onInStockOnlyChange!(!inStockOnly),
              ),
            ],

            // 10. CLEAR ALL (shown only when filters are active)
            if (hasActiveFilters && onClear != null) ...[
              const SizedBox(width: 6),
              InkWell(
                onTap: onClear,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.close_rounded,
                        size: 14,
                        color: Color(0xFFEF4444),
                      ),
                      const SizedBox(width: 3),
                      Text(
                        'Clear',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFFEF4444),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static const _brandGreen = Color(0xFF0C831F);
  static const _sheetRadius = BorderRadius.vertical(top: Radius.circular(24));

  Widget _buildPillButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    bool showDropdownArrow = false,
    VoidCallback? onTap,
  }) {
    final fg = isSelected ? Colors.white : const Color(0xFF374151);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? _brandGreen : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? _brandGreen : const Color(0xFFE5E7EB),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 4),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: fg,
              ),
            ),
            if (showDropdownArrow) ...[
              const SizedBox(width: 2),
              Icon(Icons.keyboard_arrow_down_rounded, size: 15, color: fg),
            ],
          ],
        ),
      ),
    );
  }



  Widget _buildDiscountPill(BuildContext context) {
    final hasDiscount =
        selectedMinDiscount != null && selectedMinDiscount!.isNotEmpty;
    final isDiscountSort = sortBy == ProductSortOption.discountAsc ||
        sortBy == ProductSortOption.discountDesc;
    final label = hasDiscount
        ? '$selectedMinDiscount%+ Off'
        : isDiscountSort
            ? sortBy.label
            : 'Discount';

    return _buildPillButton(
      icon: Icons.percent_rounded,
      label: label,
      isSelected: hasDiscount || isDiscountSort,
      showDropdownArrow: true,
      onTap: () => _showDiscountModal(context),
    );
  }

  void _showDiscountModal(BuildContext context) {
    final options = [
      (label: 'All Discounts (Clear)', value: null),
      (label: '10% or more', value: '10'),
      (label: '20% or more', value: '20'),
      (label: '30% or more', value: '30'),
      (label: '40% or more', value: '40'),
      (label: '50% or more', value: '50'),
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: _sheetRadius,
          ),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text(
                'Filter / Sort by Discount',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Sort Order',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        onSortChange(ProductSortOption.discountDesc);
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        side: BorderSide(
                          color: sortBy == ProductSortOption.discountDesc
                              ? _brandGreen
                              : const Color(0xFFCBD5E1),
                          width: sortBy == ProductSortOption.discountDesc ? 1.5 : 1,
                        ),
                        backgroundColor: sortBy == ProductSortOption.discountDesc
                            ? _brandGreen.withValues(alpha: 0.10)
                            : Colors.white,
                      ),
                      child: Text(
                        'Discount: High to Low',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: sortBy == ProductSortOption.discountDesc
                              ? _brandGreen
                              : const Color(0xFF334155),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        onSortChange(ProductSortOption.discountAsc);
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        side: BorderSide(
                          color: sortBy == ProductSortOption.discountAsc
                              ? _brandGreen
                              : const Color(0xFFCBD5E1),
                          width: sortBy == ProductSortOption.discountAsc ? 1.5 : 1,
                        ),
                        backgroundColor: sortBy == ProductSortOption.discountAsc
                            ? _brandGreen.withValues(alpha: 0.10)
                            : Colors.white,
                      ),
                      child: Text(
                        'Discount: Low to High',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: sortBy == ProductSortOption.discountAsc
                              ? _brandGreen
                              : const Color(0xFF334155),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Minimum Discount',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 4),
              ...options.map((opt) {
                final isCurrent = (opt.value == null &&
                        (selectedMinDiscount == null ||
                            selectedMinDiscount!.isEmpty)) ||
                    (selectedMinDiscount == opt.value);
                return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    isCurrent
                        ? Icons.radio_button_checked_rounded
                        : Icons.radio_button_off_rounded,
                    color: isCurrent
                        ? _brandGreen
                        : const Color(0xFF94A3B8),
                  ),
                  title: Text(
                    opt.label,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                      color: isCurrent
                          ? _brandGreen
                          : const Color(0xFF1E293B),
                    ),
                  ),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    if (onDiscountChange != null) {
                      onDiscountChange!(opt.value);
                    }
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildWeightSizePill(BuildContext context) {
    final hasWeight =
        selectedWeightSize != null && selectedWeightSize!.isNotEmpty;
    final isWeightSort = sortBy == ProductSortOption.weightAsc ||
        sortBy == ProductSortOption.weightDesc;
    final label = hasWeight
        ? 'Size: $selectedWeightSize'
        : isWeightSort
            ? sortBy.label
            : 'By Weight / Size';

    return _buildPillButton(
      icon: Icons.scale_outlined,
      label: label,
      isSelected: hasWeight || isWeightSort,
      showDropdownArrow: true,
      onTap: () => _showWeightSizeModal(context),
    );
  }

  void _showWeightSizeModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: _sheetRadius,
          ),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text(
                'Filter / Sort by Weight & Size',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 12),
              // Sort by weight options
              Text(
                'Sort Order',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        onSortChange(ProductSortOption.weightAsc);
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        side: BorderSide(
                          color: sortBy == ProductSortOption.weightAsc
                              ? _brandGreen
                              : const Color(0xFFCBD5E1),
                          width: sortBy == ProductSortOption.weightAsc ? 1.5 : 1,
                        ),
                        backgroundColor: sortBy == ProductSortOption.weightAsc
                            ? _brandGreen.withValues(alpha: 0.10)
                            : Colors.white,
                      ),
                      child: Text(
                        'Weight: Low to High',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: sortBy == ProductSortOption.weightAsc
                              ? _brandGreen
                              : const Color(0xFF334155),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        onSortChange(ProductSortOption.weightDesc);
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        side: BorderSide(
                          color: sortBy == ProductSortOption.weightDesc
                              ? _brandGreen
                              : const Color(0xFFCBD5E1),
                          width: sortBy == ProductSortOption.weightDesc ? 1.5 : 1,
                        ),
                        backgroundColor: sortBy == ProductSortOption.weightDesc
                            ? _brandGreen.withValues(alpha: 0.10)
                            : Colors.white,
                      ),
                      child: Text(
                        'Weight: High to Low',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: sortBy == ProductSortOption.weightDesc
                              ? _brandGreen
                              : const Color(0xFF334155),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              // Filter by specific weight/size
              if (weightsSizes.isNotEmpty) ...[
                Text(
                  'Select Pack Size / Weight',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    InkWell(
                      onTap: () {
                        Navigator.of(ctx).pop();
                        if (onWeightSizeChange != null) {
                          onWeightSizeChange!(null);
                        }
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: selectedWeightSize == null
                              ? _brandGreen.withValues(alpha: 0.10)
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: selectedWeightSize == null
                                ? _brandGreen
                                : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Text(
                          'All Sizes',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: selectedWeightSize == null
                                ? _brandGreen
                                : const Color(0xFF475569),
                          ),
                        ),
                      ),
                    ),
                    ...weightsSizes.map((size) {
                      final isSelected = selectedWeightSize?.toLowerCase() ==
                          size.toLowerCase();
                      return InkWell(
                        onTap: () {
                          Navigator.of(ctx).pop();
                          if (onWeightSizeChange != null) {
                            onWeightSizeChange!(isSelected ? null : size);
                          }
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? _brandGreen.withValues(alpha: 0.10)
                                : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isSelected
                                  ? _brandGreen
                                  : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: Text(
                            size,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              fontWeight: isSelected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: isSelected
                                  ? _brandGreen
                                  : const Color(0xFF475569),
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildBrandPill(BuildContext context) {
    final hasBrand = selectedBrand.isNotEmpty;
    final label = hasBrand ? 'Brand: $selectedBrand' : 'Brand';

    return _buildPillButton(
      icon: Icons.verified_outlined,
      label: label,
      isSelected: hasBrand,
      showDropdownArrow: true,
      onTap: () => _showBrandModal(context),
    );
  }

  void _showBrandModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.70,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: _sheetRadius,
          ),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text(
                'Filter by Brand',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    children: [
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          sortBy == ProductSortOption.brand
                              ? Icons.radio_button_checked_rounded
                              : Icons.radio_button_off_rounded,
                          color: sortBy == ProductSortOption.brand
                              ? _brandGreen
                              : const Color(0xFF94A3B8),
                        ),
                        title: Text(
                          'Sort by Brand (A-Z)',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: sortBy == ProductSortOption.brand
                                ? FontWeight.w800
                                : FontWeight.w600,
                            color: sortBy == ProductSortOption.brand
                                ? _brandGreen
                                : const Color(0xFF1E293B),
                          ),
                        ),
                        onTap: () {
                          Navigator.of(ctx).pop();
                          onSortChange(ProductSortOption.brand);
                        },
                      ),
                      const Divider(height: 12, color: Color(0xFFE2E8F0)),
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          selectedBrand.isEmpty && sortBy != ProductSortOption.brand
                              ? Icons.radio_button_checked_rounded
                              : Icons.radio_button_off_rounded,
                          color: selectedBrand.isEmpty && sortBy != ProductSortOption.brand
                              ? _brandGreen
                              : const Color(0xFF94A3B8),
                        ),
                        title: Text(
                          'All brands (Clear filter)',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: selectedBrand.isEmpty && sortBy != ProductSortOption.brand
                                ? FontWeight.w800
                                : FontWeight.w600,
                            color: selectedBrand.isEmpty && sortBy != ProductSortOption.brand
                                ? _brandGreen
                                : const Color(0xFF1E293B),
                          ),
                        ),
                        onTap: () {
                          Navigator.of(ctx).pop();
                          onBrandChange('');
                        },
                      ),
                      ...brands.map((b) {
                        final isCurrent =
                            selectedBrand.toLowerCase() == b.toLowerCase();
                        return ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            isCurrent
                                ? Icons.radio_button_checked_rounded
                                : Icons.radio_button_off_rounded,
                            color: isCurrent
                                ? _brandGreen
                                : const Color(0xFF94A3B8),
                          ),
                          title: Text(
                            b,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight:
                                  isCurrent ? FontWeight.w800 : FontWeight.w600,
                              color: isCurrent
                                  ? _brandGreen
                                  : const Color(0xFF1E293B),
                            ),
                          ),
                          onTap: () {
                            Navigator.of(ctx).pop();
                            onBrandChange(b);
                          },
                        );
                      }),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
