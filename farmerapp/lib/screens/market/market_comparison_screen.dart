import 'dart:math';
import 'package:flutter/material.dart';
import '../../core/widgets/skeleton_loader.dart';
import '../../models/market_price_item.dart';
import '../../services/market_price_service.dart';
import '../../services/app_language.dart';

class MarketComparisonScreen extends StatefulWidget {
  final String? initialProduct;
  const MarketComparisonScreen({super.key, this.initialProduct});

  @override
  State<MarketComparisonScreen> createState() => _MarketComparisonScreenState();
}

class _MarketComparisonScreenState extends State<MarketComparisonScreen> {
  int _selectedProductIndex = 0;
  int _selectedDateIndex = 0; // 0: Today, 1: Yesterday, 2: 2 Days Ago, -1: Custom Date, 3: All
  DateTime? _customDate;
  bool _initialProductApplied = false;

  static const List<Color> _chartColors = [
    Color(0xFF16A34A), // Emerald Green
    Color(0xFF2563EB), // Royal Blue
    Color(0xFF8B5CF6), // Violet
    Color(0xFFEA580C), // Orange
    Color(0xFF06B6D4), // Cyan
    Color(0xFFF59E0B), // Amber
    Color(0xFFDC2626), // Rose
  ];

  @override
  void initState() {
    super.initState();
    // fetchMarketPrices notifies listeners synchronously (the dashboard listens too),
    // which must not happen while this route is being built.
    WidgetsBinding.instance.addPostFrameCallback((_) => MarketPriceService().fetchMarketPrices());
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: MarketPriceService(),
      builder: (context, _) {
        final service = MarketPriceService();
        final lang = AppLanguage();
        String? targetDate;
        final now = DateTime.now();
        if (_selectedDateIndex == -1 && _customDate != null) {
          targetDate = _customDate!.toIso8601String().substring(0, 10);
        } else if (_selectedDateIndex == 0) {
          targetDate = now.toIso8601String().substring(0, 10);
        } else if (_selectedDateIndex == 1) {
          targetDate = now.subtract(const Duration(days: 1)).toIso8601String().substring(0, 10);
        } else if (_selectedDateIndex == 2) {
          targetDate = now.subtract(const Duration(days: 2)).toIso8601String().substring(0, 10);
        } else {
          targetDate = null;
        }

        final comparisons = service.getComparisons(date: targetDate);

        if (!_initialProductApplied && comparisons.isNotEmpty && widget.initialProduct != null && widget.initialProduct!.isNotEmpty) {
          _initialProductApplied = true;
          final idx = comparisons.indexWhere((c) =>
              c.productName.toLowerCase().contains(widget.initialProduct!.toLowerCase()) ||
              widget.initialProduct!.toLowerCase().contains(c.cleanProductName.toLowerCase()));
          if (idx != -1) {
            _selectedProductIndex = idx;
          }
        }
        final loadFailed = service.items.isEmpty && service.lastError.isNotEmpty;

        if (service.isLoading && comparisons.isEmpty) {
          return const MarketComparisonSkeletonLoader();
        }

        final selected = comparisons.isNotEmpty
            ? comparisons[_selectedProductIndex.clamp(0, comparisons.length - 1)]
            : null;

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0.5,
            surfaceTintColor: Colors.transparent,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1F2937)),
              onPressed: () => Navigator.pop(context),
            ),
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lang.tr(mr: 'बाजार भाव तुलना', en: 'Market Price Comparison'),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                ),
                Text(
                  lang.tr(mr: 'नफा विश्लेषण व थेट बाजारपेठ', en: 'Price analysis & live market rates'),
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: service.isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF16A34A)),
                      )
                    : const Icon(Icons.sync_rounded, color: Color(0xFF16A34A), size: 22),
                tooltip: AppLanguage().tr(mr: 'ताजे दर आणा', en: 'Refresh'),
                onPressed: () => service.fetchMarketPrices(),
              ),
            ],
          ),
          body: RefreshIndicator(
            color: const Color(0xFF16A34A),
            onRefresh: () => service.fetchMarketPrices(),
            child: comparisons.isEmpty
                ? ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    children: [
                      _buildDateRow(),
                      const SizedBox(height: 40),
                      Center(
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0FDF4),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: const Color(0xFFDCFCE7)),
                                ),
                                child: const Icon(
                                  Icons.storefront_outlined,
                                  color: Color(0xFF16A34A),
                                  size: 28,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                loadFailed
                                    ? lang.tr(
                                        mr: 'बाजारभाव लोड झाले नाहीत',
                                        en: 'Could not load market prices',
                                      )
                                    : _selectedDateIndex == 0
                                    ? lang.tr(
                                        mr: 'आजचे बाजारभाव अजून जोडलेले नाहीत',
                                        en: "Today's market prices not added yet",
                                      )
                                    : (targetDate != null
                                        ? lang.tr(
                                            mr: '$targetDate चे बाजारभाव उपलब्ध नाहीत',
                                            en: 'No market rates available on $targetDate',
                                          )
                                        : lang.tr(
                                            mr: 'या तारखेचे बाजारभाव उपलब्ध नाहीत',
                                            en: 'No market rates available for this date',
                                          )),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                loadFailed
                                    ? lang.tr(
                                        mr: 'इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.',
                                        en: 'Check your internet connection and try again.',
                                      )
                                    : lang.tr(
                                        mr: 'ॲडमिनने दर अपडेट केल्यानंतर ते येथे आपोआप दिसतील.',
                                        en: 'Rates will appear here automatically once updated by Admin.',
                                      ),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF64748B),
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 20),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF16A34A),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                                ),
                                icon: const Icon(Icons.refresh_rounded, size: 16),
                                label: Text(
                                  lang.tr(mr: 'ताजे दर आणा', en: 'Refresh Rates'),
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                                onPressed: () => service.fetchMarketPrices(),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Date selector
                        _buildDateRow(),
                        const SizedBox(height: 12),

                        // Top Summary Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF166534), Color(0xFF15803D)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF166534).withValues(alpha: 0.25),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      AppLanguage().tr(mr: 'थेट मंडी दर', en: 'LIVE MANDI RATES'),
                                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                                    ),
                                  ),
                                  const Spacer(),
                                  const Icon(Icons.trending_up_rounded, color: Color(0xFF86EFAC), size: 20),
                                  const SizedBox(width: 4),
                                  Text(
                                    AppLanguage().tr(mr: 'कमाल नफा संधी', en: 'Maximum Profit Opportunity'),
                                    style: TextStyle(color: Color(0xFF86EFAC), fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                AppLanguage().tr(mr: 'विविध बाजार समित्यांमधील दरांची तुलना', en: 'Compare rates across market committees'),
                                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                AppLanguage().tr(mr: 'कोणत्या मार्केटला शेतमाल विकल्यास जास्त भाव मिळेल हे खालील डोनट चार्ट व तुलना तक्त्यावरून समजून घ्या.', en: 'See which market gives the best price for your produce using the donut chart and comparison table below.'),
                                style: TextStyle(color: Color(0xFFDCFCE7), fontSize: 11, height: 1.3),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Product Selection Horizontal Bar
                        Text(
                          AppLanguage().tr(mr: 'शेतमाल निवडा', en: 'Select Product'),
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 44,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: comparisons.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 8),
                            itemBuilder: (context, idx) {
                              final item = comparisons[idx];
                              final isSelected = idx == _selectedProductIndex;
                              return InkWell(
                                onTap: () => setState(() => _selectedProductIndex = idx),
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  alignment: Alignment.center,
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: isSelected ? const Color(0xFF16A34A) : Colors.white,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
                                      width: isSelected ? 1.5 : 1,
                                    ),
                                    boxShadow: [
                                      if (isSelected)
                                        BoxShadow(
                                          color: const Color(0xFF16A34A).withValues(alpha: 0.2),
                                          blurRadius: 6,
                                          offset: const Offset(0, 2),
                                        ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(item.emoji, style: const TextStyle(fontSize: 14)),
                                      const SizedBox(width: 6),
                                      Text(
                                        item.cleanProductName,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                          color: isSelected ? Colors.white : const Color(0xFF334155),
                                        ),
                                      ),
                                      if (item.bestAdvantagePercent > 0) ...[
                                        const SizedBox(width: 5),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: isSelected ? Colors.white.withValues(alpha: 0.25) : const Color(0xFFDCFCE7),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            '+${item.bestAdvantagePercent.toStringAsFixed(1)}%',
                                            style: TextStyle(
                                              fontSize: 9.5,
                                              fontWeight: FontWeight.bold,
                                              color: isSelected ? Colors.white : const Color(0xFF16A34A),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                        const SizedBox(height: 16),

                        if (selected != null) ...[
                          // 🌿 GreenGrocc Direct Procurement Spotlight Card
                          if (selected.hasGreenGrocc && selected.greenGroccRate != null) ...[
                            Container(
                              padding: const EdgeInsets.all(15),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF064E3B), Color(0xFF047857), Color(0xFF0D9488)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF047857).withValues(alpha: 0.35),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(alpha: 0.22),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text('🌿', style: TextStyle(fontSize: 11)),
                                            SizedBox(width: 4),
                                            Text(
                                              AppLanguage().tr(mr: 'GREENGROCC थेट खरेदी दर', en: 'GREENGROCC DIRECT PURCHASE RATE'),
                                              style: TextStyle(
                                                color: Colors.white,
                                                fontSize: 10.5,
                                                fontWeight: FontWeight.bold,
                                                letterSpacing: 0.4,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Spacer(),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: selected.greenGroccVsAvgPercent >= 0
                                              ? const Color(0xFF10B981)
                                              : const Color(0xFFEF4444),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          selected.greenGroccVsAvgPercent >= 0
                                              ? AppLanguage().tr(mr: '+${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% जास्त भाव 📈', en: '+${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% higher price 📈')
                                              : AppLanguage().tr(mr: '${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% कमी भाव 📉', en: '${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% lower price 📉'),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.baseline,
                                    textBaseline: TextBaseline.alphabetic,
                                    children: [
                                      Text(
                                        '₹${selected.greenGroccRate!.price.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 24,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                      Text(
                                        ' / ${AppLanguage().pick(selected.unit)}',
                                        style: const TextStyle(
                                          color: Color(0xFFA7F3D0),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const Spacer(),
                                      Text(
                                        selected.greenGroccDiffAmount >= 0
                                            ? AppLanguage().tr(mr: '+₹${selected.greenGroccDiffAmount.toStringAsFixed(0)} जादा नफा', en: '+₹${selected.greenGroccDiffAmount.toStringAsFixed(0)} extra profit')
                                            : AppLanguage().tr(mr: '-₹${selected.greenGroccDiffAmount.abs().toStringAsFixed(0)} फरक', en: '-₹${selected.greenGroccDiffAmount.abs().toStringAsFixed(0)} difference'),
                                        style: const TextStyle(
                                          color: Color(0xFFD1FAE5),
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    AppLanguage().tr(mr: '✓ थेट बांधावरून खरेदी • ०% कमिशन • २४ तासांत खात्यात थेट पेमेंट • बाजार समितीपेक्षा हमीभाव', en: '✓ Direct farm-gate purchase • 0% commission • Payment to your account within 24 hours • Assured price above market committee'),
                                    style: TextStyle(
                                      color: Color(0xFFD1FAE5),
                                      fontSize: 10.5,
                                      height: 1.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],

                          // Best Market Recommendation Banner
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDF4),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFBBF7D0)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF16A34A),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.star_rounded, color: Colors.white, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        crossAxisAlignment: CrossAxisAlignment.center,
                                        children: [
                                          Expanded(
                                            child: Text(
                                              AppLanguage().tr(mr: 'सर्वाधिक फायदेशीर बाजार समिती', en: 'Most Profitable Market'),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF15803D)),
                                            ),
                                          ),
                                          if (selected.bestAdvantagePercent > 0) ...[
                                            const SizedBox(width: 8),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF16A34A),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text(
                                                AppLanguage().tr(mr: '+${selected.bestAdvantagePercent.toStringAsFixed(1)}% जास्त भाव 📈', en: '+${selected.bestAdvantagePercent.toStringAsFixed(1)}% higher price 📈'),
                                                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        selected.bestMarketName,
                                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        selected.markets.length > 1
                                            ? AppLanguage().tr(mr: 'कमाल दर ₹${selected.maxPrice.toStringAsFixed(0)}/${AppLanguage().pick(selected.unit)} (इतर बाजारांपेक्षा ₹${(selected.maxPrice - selected.minPrice).toStringAsFixed(0)} जास्त)', en: 'Max rate ₹${selected.maxPrice.toStringAsFixed(0)}/${AppLanguage().pick(selected.unit)} (₹${(selected.maxPrice - selected.minPrice).toStringAsFixed(0)} higher than other markets)')
                                            : AppLanguage().tr(mr: 'दर ₹${selected.maxPrice.toStringAsFixed(0)}/${AppLanguage().pick(selected.unit)} (तुलनेसाठी एकच बाजार)', en: 'Rate ₹${selected.maxPrice.toStringAsFixed(0)}/${AppLanguage().pick(selected.unit)} (only one market to compare)'),
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Donut Chart Card
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.03),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Row(
                                        children: [
                                          Text(selected.emoji, style: const TextStyle(fontSize: 16)),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              AppLanguage().tr(mr: '${selected.productName} — बाजार तुलना डोनट चार्ट', en: '${selected.productName} — Market Comparison Donut Chart'),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Text(
                                        AppLanguage().tr(mr: '${selected.markets.length} बाजार', en: '${selected.markets.length} Markets'),
                                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 18),

                                // Donut Chart + Legend
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    // Custom Painted Donut Chart
                                    SizedBox(
                                      width: 140,
                                      height: 140,
                                      child: Stack(
                                        alignment: Alignment.center,
                                        children: [
                                          CustomPaint(
                                            size: const Size(140, 140),
                                            painter: _MarketDonutPainter(
                                              markets: selected.markets,
                                              colors: _chartColors,
                                              strokeWidth: 18,
                                            ),
                                          ),
                                          Column(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(
                                                '₹${selected.maxPrice.toStringAsFixed(0)}',
                                                style: const TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w900,
                                                  color: Color(0xFF16A34A),
                                                ),
                                              ),
                                              Text(
                                                AppLanguage().tr(mr: 'कमाल दर', en: 'Max Rate'),
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF64748B),
                                                ),
                                              ),
                                              Text(
                                                '+${selected.bestAdvantagePercent.toStringAsFixed(1)}%',
                                                style: const TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF15803D),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),

                                    const SizedBox(width: 16),

                                    // Legend & Comparison breakdown
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          ...selected.markets.asMap().entries.map((entry) {
                                            final idx = entry.key;
                                            final m = entry.value;
                                            final color = _chartColors[idx % _chartColors.length];

                                            return Padding(
                                              padding: const EdgeInsets.only(bottom: 7),
                                              child: Row(
                                                children: [
                                                  Container(
                                                    width: 9,
                                                    height: 9,
                                                    decoration: BoxDecoration(
                                                      color: color,
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Expanded(
                                                    child: Text(
                                                      m.marketName.replaceAll('APMC', '').trim(),
                                                      maxLines: 1,
                                                      overflow: TextOverflow.ellipsis,
                                                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    '₹${m.price.toStringAsFixed(0)}',
                                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    m.percentHigher > 0
                                                        ? '(+${m.percentHigher.toStringAsFixed(1)}%)'
                                                        : AppLanguage().tr(mr: '(आधार)', en: '(Base)'),
                                                    style: TextStyle(
                                                      fontSize: 9,
                                                      fontWeight: FontWeight.bold,
                                                      color: m.percentHigher > 0 ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            );
                                          }),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Detailed Markets Comparison Cards
                          Text(
                            AppLanguage().tr(mr: 'सर्व बाजारांमधील दर व तुलना तपशील', en: 'Rates & comparison across all markets'),
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                          ),
                          const SizedBox(height: 8),

                          ...selected.markets.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final m = entry.value;
                            final color = _chartColors[idx % _chartColors.length];

                            final isGg = m.isGreenGroo;
                            final borderColor = isGg
                                ? const Color(0xFF10B981)
                                : m.isBest
                                    ? const Color(0xFF86EFAC)
                                    : const Color(0xFFE2E8F0);
                            final bgColor = isGg ? const Color(0xFFF0FDF4) : Colors.white;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: bgColor,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: borderColor,
                                  width: (isGg || m.isBest) ? 1.5 : 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: isGg
                                        ? const Color(0xFF10B981).withValues(alpha: 0.12)
                                        : Colors.black.withValues(alpha: 0.02),
                                    blurRadius: isGg ? 6 : 4,
                                    offset: const Offset(0, 1),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 40,
                                    height: 40,
                                    decoration: BoxDecoration(
                                      color: isGg
                                          ? const Color(0xFF059669)
                                          : color.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Center(
                                      child: isGg
                                          ? const Text('🌿', style: TextStyle(fontSize: 18))
                                          : Icon(Icons.storefront_rounded, color: color, size: 22),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                m.marketName,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 12.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: isGg ? const Color(0xFF065F46) : const Color(0xFF0F172A),
                                                ),
                                              ),
                                            ),
                                            if (isGg) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF047857),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: const Text(
                                                  '🌿 GreenGrocc',
                                                  style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.bold),
                                                ),
                                              ),
                                            ] else if (m.isBest) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFDCFCE7),
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  AppLanguage().tr(mr: '★ सर्वोच्च भाव', en: '★ Highest Price'),
                                                  style: TextStyle(color: Color(0xFF16A34A), fontSize: 9.5, fontWeight: FontWeight.bold),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          isGg
                                              ? AppLanguage().tr(mr: 'GreenGrocc थेट शेतकरी खरेदी हमीभाव • ०% कमिशन', en: 'GreenGrocc direct farmer purchase assured price • 0% commission')
                                              : AppLanguage().tr(mr: 'किमान: ₹${m.minPrice.toStringAsFixed(0)} • कमाल: ₹${m.maxPrice.toStringAsFixed(0)} • ${m.district}', en: 'Min: ₹${m.minPrice.toStringAsFixed(0)} • Max: ₹${m.maxPrice.toStringAsFixed(0)} • ${m.district}'),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: isGg ? const Color(0xFF047857) : const Color(0xFF64748B),
                                            fontWeight: isGg ? FontWeight.w500 : FontWeight.normal,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        '₹${m.price.toStringAsFixed(0)}',
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w900,
                                          color: isGg ? const Color(0xFF065F46) : const Color(0xFF0F172A),
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      if (isGg) ...[
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: selected.greenGroccVsAvgPercent >= 0
                                                ? const Color(0xFFDCFCE7)
                                                : const Color(0xFFFEE2E2),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(
                                              color: selected.greenGroccVsAvgPercent >= 0
                                                  ? const Color(0xFF86EFAC)
                                                  : const Color(0xFFFCA5A5),
                                            ),
                                          ),
                                          child: Text(
                                            selected.greenGroccVsAvgPercent >= 0
                                                ? AppLanguage().tr(mr: '+${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% जास्त भाव', en: '+${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% higher price')
                                                : AppLanguage().tr(mr: '${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% कमी भाव', en: '${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}% lower price'),
                                            style: TextStyle(
                                              fontSize: 9.5,
                                              fontWeight: FontWeight.bold,
                                              color: selected.greenGroccVsAvgPercent >= 0
                                                  ? const Color(0xFF16A34A)
                                                  : const Color(0xFFDC2626),
                                            ),
                                          ),
                                        ),
                                      ] else ...[
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: m.percentHigher > 0 ? const Color(0xFFF0FDF4) : const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(
                                              color: m.percentHigher > 0 ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
                                            ),
                                          ),
                                          child: Text(
                                            m.percentHigher > 0 ? AppLanguage().tr(mr: '+${m.percentHigher.toStringAsFixed(1)}% जास्त', en: '+${m.percentHigher.toStringAsFixed(1)}% higher') : AppLanguage().tr(mr: 'आधार दर', en: 'Base Rate'),
                                            style: TextStyle(
                                              fontSize: 9.5,
                                              fontWeight: FontWeight.bold,
                                              color: m.percentHigher > 0 ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ],
                    ),
                  ),
          ),
        );
      },
    );
  }

  Widget _buildDateRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _dateFilterChip(0, AppLanguage().tr(mr: 'आजचे दर', en: 'Today')),
          const SizedBox(width: 6),
          _dateFilterChip(1, AppLanguage().tr(mr: 'कालचे दर', en: 'Yesterday')),
          const SizedBox(width: 6),
          _dateFilterChip(2, AppLanguage().tr(mr: '२ दिवस आधी', en: '2 Days')),
          const SizedBox(width: 6),
          _buildCustomDatePickerChip(),
          const SizedBox(width: 6),
          _dateFilterChip(3, AppLanguage().tr(mr: 'सर्व दिवस', en: 'All Dates')),
        ],
      ),
    );
  }

  Widget _buildCustomDatePickerChip() {
    final isSel = _selectedDateIndex == -1;
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: _customDate ?? DateTime.now(),
          firstDate: DateTime.now().subtract(const Duration(days: 365)),
          lastDate: DateTime.now().add(const Duration(days: 30)),
          builder: (context, child) {
            return Theme(
              data: Theme.of(context).copyWith(
                colorScheme: const ColorScheme.light(
                  primary: Color(0xFF16A34A),
                  onPrimary: Colors.white,
                  onSurface: Color(0xFF1E293B),
                ),
              ),
              child: child!,
            );
          },
        );
        if (picked != null) {
          setState(() {
            _customDate = picked;
            _selectedDateIndex = -1;
          });
          MarketPriceService().fetchMarketPrices(date: picked.toIso8601String().substring(0, 10));
        }
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF16A34A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSel ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
          ),
          boxShadow: [
            if (isSel)
              BoxShadow(
                color: const Color(0xFF16A34A).withValues(alpha: 0.2),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.calendar_month_rounded,
              size: 13,
              color: isSel ? Colors.white : const Color(0xFF16A34A),
            ),
            const SizedBox(width: 4),
            Text(
              isSel && _customDate != null
                  ? '${_customDate!.day}/${_customDate!.month}/${_customDate!.year}'
                  : AppLanguage().tr(mr: '📅 तारीख निवडा', en: '📅 Select Date'),
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: isSel ? FontWeight.bold : FontWeight.w600,
                color: isSel ? Colors.white : const Color(0xFF16A34A),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateFilterChip(int index, String label) {
    final isSel = _selectedDateIndex == index;
    return InkWell(
      onTap: () => setState(() => _selectedDateIndex = index),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF16A34A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSel ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
          ),
          boxShadow: [
            if (isSel)
              BoxShadow(
                color: const Color(0xFF16A34A).withValues(alpha: 0.2),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w600,
            color: isSel ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}

class _MarketDonutPainter extends CustomPainter {
  final List<MarketRateComparison> markets;
  final List<Color> colors;
  final double strokeWidth;

  _MarketDonutPainter({
    required this.markets,
    required this.colors,
    this.strokeWidth = 18.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (min(size.width, size.height) - strokeWidth) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    final total = markets.fold<double>(0.0, (acc, m) => acc + m.price);

    if (total <= 0) {
      final paint = Paint()
        ..color = const Color(0xFF16A34A)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth;
      canvas.drawCircle(center, radius, paint);
      return;
    }

    var startAngle = -pi / 2;

    for (int i = 0; i < markets.length; i++) {
      final m = markets[i];
      final sweepAngle = (m.price / total) * 2 * pi;
      final color = colors[i % colors.length];

      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      // Small gap between slices
      final gap = 0.05;
      final adjustedSweep = max(0.02, sweepAngle - gap);

      canvas.drawArc(rect, startAngle + gap / 2, adjustedSweep, false, paint);
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant _MarketDonutPainter oldDelegate) {
    return oldDelegate.markets != markets;
  }
}
