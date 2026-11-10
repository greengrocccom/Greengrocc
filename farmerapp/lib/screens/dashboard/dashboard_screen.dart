import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/utils/photo_picker_sheet.dart';
import '../../models/farmer_models.dart';
import '../../services/farmer_state.dart';
import '../notifications/notifications_screen.dart';
import '../schemes/schemes_screen.dart';
import '../crops/crops_screen.dart';
import '../inventory/inventory_screen.dart';
import '../main_shell.dart';
import '../market/market_comparison_screen.dart';
import '../orders/order_detail_screen.dart';
import '../../services/market_price_service.dart';
import '../../services/app_language.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ScrollController _scrollController = ScrollController();
  bool _isScrolled = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    final scrolled = _scrollController.hasClients && _scrollController.offset > 24;
    if (scrolled != _isScrolled) {
      setState(() => _isScrolled = scrolled);
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _makePhoneCall(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
    if (cleanPhone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLanguage().tr(mr: 'फोन नंबर उपलब्ध नाही', en: 'Phone number not available'))),
      );
      return;
    }
    final uri = Uri.parse('tel:$cleanPhone');
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLanguage().tr(mr: 'कॉल करता आला नाही: $cleanPhone', en: 'Could not place call: $cleanPhone'))),
        );
      }
    }
  }

  String _formatPickupDateWithDay(String dateStr, String dayStr) {
    if (dateStr.trim().isEmpty) return AppLanguage().tr(mr: 'लवकरच', en: 'Soon');
    String cleanDate = dateStr.trim();
    String cleanDay = dayStr.trim();

    final parsed = DateTime.tryParse(cleanDate);
    if (parsed != null) {
      cleanDate = '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
      if (cleanDay.isEmpty) {
        const weekdaysEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weekdaysMr = ['सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार', 'रविवार'];
        final dayIdx = (parsed.weekday - 1).clamp(0, 6);
        cleanDay = AppLanguage().tr(mr: weekdaysMr[dayIdx], en: weekdaysEn[dayIdx]);
      }
    }
    if (cleanDay.isNotEmpty) {
      return '$cleanDate ($cleanDay)';
    }
    return cleanDate;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: FarmerState(),
      builder: (context, _) {
        final state = FarmerState();

        if (!state.isPreferencesLoaded) {
          return const _DashboardSkeletonLoader();
        }
        final overviewReady = state.productsReady && state.cropsReady && state.ordersReady;

        final profile = state.profile;
        final crops = state.crops;
        final products = state.products;

        final liveOrders = state.orders.where((o) {
          final s = o.status.toUpperCase();
          return s != 'DELETED' && s != 'DELETED_ORDER';
        }).toList();

        final settledOrders = liveOrders.where(_isEarningOrder).toList();
        final totalEarned = settledOrders.fold<double>(0, (sum, o) => sum + _orderAmount(o));

        // Real monthly earnings calculation
        final now = DateTime.now();
        final thisMonthOrders = settledOrders.where((o) {
          if (o.createdAt.isEmpty) return true;
          try {
            final d = DateTime.parse(o.createdAt);
            return d.year == now.year && d.month == now.month;
          } catch (_) {
            return true;
          }
        }).toList();
        final monthlyEarned = thisMonthOrders.fold<double>(0, (sum, o) => sum + _orderAmount(o));

        final totalStock = state.totalStockKg;

        // Real profile details
        final firstName = profile.fullName.trim().isEmpty ? AppLanguage().tr(mr: 'शेतकरी', en: 'Farmer') : profile.fullName.trim().split(RegExp(r'\s+')).first;

        final totalCropsCount = crops.length;
        final kyc = profile.kycStatus.trim().toUpperCase();
        final kycVerified = kyc.contains('VERIF') || kyc.contains('APPROV');

        // Real formatted metric values
        final totalProductsVal = '${products.length}';
        final harvestOrdersVal = '${liveOrders.length}';
        final totalStockVal = totalStock > 0 ? AppLanguage().tr(mr: '${totalStock.toStringAsFixed(0)} किलो', en: '${totalStock.toStringAsFixed(0)} Kg') : AppLanguage().tr(mr: '0 किलो', en: '0 Kg');

        // Real pickup orders (STRICTLY only show when driver is assigned)
        final pickupOrders = liveOrders.where((o) {
          final s = o.status.toUpperCase();
          final isNotDone = !s.contains('COMPLETED') && !s.contains('REJECT') && !s.contains('CANCEL') && !s.contains('DELETED');
          return isNotDone && o.isDriverAssigned;
        }).toList();

        final topPadding = MediaQuery.of(context).padding.top;
        final heroHeight = topPadding + kToolbarHeight + 138.0;

        return Scaffold(
          backgroundColor: const Color(0xFFF6F8F5),
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            backgroundColor: _isScrolled ? Colors.white : Colors.transparent,
            elevation: _isScrolled ? 2.5 : 0,
            shadowColor: Colors.black.withValues(alpha: 0.08),
            surfaceTintColor: Colors.transparent,
            systemOverlayStyle: const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.dark,
            ),
            leading: IconButton(
              icon: const Icon(Icons.menu_rounded, color: Color(0xFF1F2937), size: 26),
              tooltip: AppLanguage().tr(mr: 'मेनू उघडा', en: 'Open Menu'),
              onPressed: () => MainShell.openDrawer(context),
            ),
            titleSpacing: 0,
            title: Row(
              children: [
                InkWell(
                  onTap: () => MainShell.setTab(context, 4),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: profile.profilePhoto.trim().isNotEmpty
                            ? const Color(0xFF16A34A)
                            : const Color(0xFFC8E6C9),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: profile.profilePhoto.trim().isNotEmpty
                        ? AppImageWidget(
                            imageStr: profile.profilePhoto,
                            width: 38,
                            height: 38,
                            fit: BoxFit.cover,
                            fallback: const Center(
                              child: Icon(Icons.person_rounded, color: Color(0xFF16A34A), size: 22),
                            ),
                          )
                        : const Center(
                            child: Icon(Icons.agriculture_rounded, color: Color(0xFF16A34A), size: 22),
                          ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        AppLanguage().tr(mr: 'GreenGrocc शेतकरी', en: 'GreenGrocc Farmer'),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1F2937),
                          letterSpacing: -0.2,
                        ),
                      ),
                      Text(
                        AppLanguage().tr(mr: 'स्वागत आहे, $firstName', en: 'Welcome, $firstName'),
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF6B7280),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()));
                    },
                    icon: const Icon(Icons.notifications_outlined, color: Color(0xFF1F2937), size: 26),
                    tooltip: AppLanguage().tr(mr: 'सूचना', en: 'Notifications'),
                  ),
                  if (state.unreadNotificationCount > 0)
                    Positioned(
                      top: 10,
                      right: 11,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          color: Color(0xFFDC2626),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 6),
            ],
          ),
          body: RefreshIndicator(
            color: const Color(0xFF16A34A),
            edgeOffset: topPadding + kToolbarHeight,
            onRefresh: () => Future.wait([
              FarmerState().refreshDashboard(),
              MarketPriceService().fetchMarketPrices(),
            ]),
            child: SingleChildScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. HERO BANNER WITH FARMER BACKGROUND
                Container(
                  width: double.infinity,
                  height: heroHeight,
                  margin: EdgeInsets.zero,
                  padding: EdgeInsets.zero,
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
                  ),
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        // Background image from assets
                        Image.asset(
                          'assets/images/farmer_hero_bg.jpg',
                          fit: BoxFit.cover,
                          alignment: const Alignment(0.65, -0.65),
                          errorBuilder: (context, error, stackTrace) => Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFFE8F5E9), Color(0xFF81C784)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                          ),
                        ),
                        // Gradient fade overlay for crisp text readability
                        Positioned.fill(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.centerLeft,
                                end: Alignment.centerRight,
                                stops: const [0.0, 0.46, 0.78, 1.0],
                                colors: [
                                  Colors.white.withValues(alpha: 0.96),
                                  Colors.white.withValues(alpha: 0.88),
                                  Colors.white.withValues(alpha: 0.20),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                        // Hero Content positioned neatly below navbar
                        Padding(
                          padding: EdgeInsets.fromLTRB(
                            12,
                            topPadding + kToolbarHeight + 4,
                            12,
                            10,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                AppLanguage().tr(
                                  mr: 'शेतीतून समृद्धी,\nआपल्या हातातच!',
                                  en: 'Prosperity from farming,\nin your hands!',
                                ),
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF14532D),
                                  height: 1.25,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.eco_rounded, size: 13, color: Color(0xFF16A34A)),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      AppLanguage().tr(
                                        mr: 'चांगले शेती नियोजन, उत्तम उत्पादन,\nआणि अधिक उत्पन्न!',
                                        en: 'Better farm planning, higher yield,\nand greater profit!',
                                      ),
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF1F2937),
                                        height: 1.35,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(Icons.eco, size: 12, color: Color(0xFF16A34A)),
                                  const SizedBox(width: 3),
                                  Container(
                                    width: 32,
                                    height: 2.5,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF16A34A).withValues(alpha: 0.7),
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                                // 12. 🏷️ REAL MARKET PRICE COMPARISON — DONUT CHART (बाजार भाव तुलना)
                _sectionHeader(
                  icon: Icons.trending_up_rounded,
                  iconColor: const Color(0xFF16A34A),
                  title: 'Market Prices',
                  marathiTitle: 'बाजार भाव तुलना',
                  actionLabel: 'All Markets →',
                  marathiActionLabel: 'सर्व बाजार →',
                  onAction: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const MarketComparisonScreen()),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: _MarketPriceComparisonDonutCard(),
                  ),
                ),

// 4. 📊 REAL FARM OVERVIEW (शेत थेट आढावा)
                _sectionHeader(
                  icon: Icons.analytics_outlined,
                  iconColor: const Color(0xFF16A34A),
                  title: 'Farm Overview',
                  marathiTitle: 'शेत थेट आढावा',
                  actionLabel: 'View Details',
                  marathiActionLabel: 'तपशील पहा',
                  onAction: () => MainShell.setTab(context, 3),
                ),
                if (!overviewReady)
                  const _SectionSkeleton(height: 78)
                else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: _OverviewStatCard(
                          icon: Icons.inventory_2_outlined,
                          iconColor: const Color(0xFF16A34A),
                          iconBg: const Color(0xFFDCFCE7),
                          label: AppLanguage().tr(mr: 'उत्पादने', en: 'Products'),
                          value: totalProductsVal,
                          onTap: () => MainShell.setTab(context, 1),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _OverviewStatCard(
                          icon: Icons.warehouse_outlined,
                          iconColor: const Color(0xFF059669),
                          iconBg: const Color(0xFFD1FAE5),
                          label: AppLanguage().tr(mr: 'शिल्लक साठा', en: 'Stock'),
                          value: totalStockVal,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const InventoryScreen()),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _OverviewStatCard(
                          icon: Icons.grass_rounded,
                          iconColor: const Color(0xFF2563EB),
                          iconBg: const Color(0xFFDBEAFE),
                          label: AppLanguage().tr(mr: 'पिके', en: 'Crops'),
                          value: '$totalCropsCount',
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const CropsScreen()),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _OverviewStatCard(
                          icon: Icons.agriculture_rounded,
                          iconColor: const Color(0xFFEA580C),
                          iconBg: const Color(0xFFFFEDD5),
                          label: AppLanguage().tr(mr: 'काढणी', en: 'Harvest'),
                          value: harvestOrdersVal,
                          onTap: () => MainShell.setTab(context, 2),
                        ),
                      ),
                    ],
                  ),
                ),

                // 5. 📦 REAL ORDERS STATUS — BAR CHART (Date + Order Type Filters)
                _sectionHeader(
                  icon: Icons.bar_chart_rounded,
                  iconColor: const Color(0xFF2563EB),
                  title: 'Orders Status',
                  marathiTitle: 'ऑर्डर स्थिती',
                  actionLabel: 'All Orders →',
                  marathiActionLabel: 'सर्व ऑर्डर्स →',
                  onAction: () => MainShell.setTab(context, 2),
                ),
                if (!state.ordersReady)
                  const _SectionSkeleton(height: 230)
                else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: _OrderStatusBaChart(
                    orders: liveOrders,
                  ),
                ),

                // 6. 🚚 REAL UPCOMING PICKUP (आगामी वाहन उचल / पिकअप)
                _sectionHeader(
                  icon: Icons.local_shipping_rounded,
                  iconColor: const Color(0xFF2563EB),
                  title: 'Upcoming Pickup',
                  marathiTitle: 'आगामी वाहन उचल',
                ),
                if (!state.ordersReady)
                  const _SectionSkeleton(height: 150)
                else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.02),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: pickupOrders.isNotEmpty
                        ? Builder(builder: (context) {
                            final currentPickup = pickupOrders.first;
                            final phoneToCall = currentPickup.driverPhone.trim().isNotEmpty
                                ? currentPickup.driverPhone.trim()
                                : currentPickup.buyerPhone.trim();
                            final driverName = currentPickup.driverName.trim().isNotEmpty
                                ? currentPickup.driverName.trim()
                                : AppLanguage().tr(mr: 'असाइन केलेला ड्रायव्हर', en: 'Assigned Driver');
                            final driverStatus = currentPickup.driverStatus.trim().isNotEmpty
                                ? currentPickup.driverStatus.trim()
                                : (currentPickup.status.trim().isNotEmpty ? currentPickup.status.trim() : 'Assigned');
                            final vehicleNo = currentPickup.vehicleNumber.trim();
                            final pickupDateFormatted = _formatPickupDateWithDay(currentPickup.pickupDate, currentPickup.day);

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Driver Info Header
                                Row(
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEFF6FF),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: const Color(0xFFDBEAFE)),
                                      ),
                                      child: const Icon(
                                        Icons.sports_motorsports_rounded,
                                        color: Color(0xFF2563EB),
                                        size: 24,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Flexible(
                                                child: Text(
                                                  driverName,
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    fontSize: 13.5,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF111827),
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                              const Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 14),
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            vehicleNo.isNotEmpty
                                                ? AppLanguage().tr(mr: '$vehicleNo • ${phoneToCall.isNotEmpty ? phoneToCall : "ड्रायव्हर"}', en: '$vehicleNo • ${phoneToCall.isNotEmpty ? phoneToCall : "Driver"}')
                                                : (phoneToCall.isNotEmpty ? '📞 $phoneToCall' : AppLanguage().tr(mr: 'ड्रायव्हर असाइन केला आहे', en: 'Driver Assigned')),
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF4B5563), fontWeight: FontWeight.w500),
                                          ),
                                          const SizedBox(height: 1),
                                          Text(
                                            AppLanguage().tr(mr: 'ऑर्डर #${currentPickup.orderCode.isNotEmpty ? currentPickup.orderCode : currentPickup.id}', en: 'Order #${currentPickup.orderCode.isNotEmpty ? currentPickup.orderCode : currentPickup.id}'),
                                            style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF), fontWeight: FontWeight.w600),
                                          ),
                                          if (currentPickup.vendorName.isNotEmpty || currentPickup.vendorBusinessName.isNotEmpty) ...[
                                            const SizedBox(height: 1),
                                            Text(
                                              AppLanguage().tr(
                                                mr: 'व्हेंडर: ${currentPickup.vendorBusinessName.isNotEmpty ? currentPickup.vendorBusinessName : currentPickup.vendorName}',
                                                en: 'Vendor: ${currentPickup.vendorBusinessName.isNotEmpty ? currentPickup.vendorBusinessName : currentPickup.vendorName}',
                                              ),
                                              style: const TextStyle(fontSize: 10, color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEFF6FF),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: const Color(0xFFBFDBFE)),
                                      ),
                                      child: Text(
                                        AppLanguage().pick(driverStatus),
                                        style: const TextStyle(
                                          color: Color(0xFF1D4ED8),
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                const Divider(height: 1, color: Color(0xFFF3F4F6)),
                                const SizedBox(height: 10),

                                // Details Grid (Date & Day, Time, Product & Qty, Amount)
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      flex: 5,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            AppLanguage().tr(mr: 'पिकअप तारीख व वार', en: 'Pickup Date & Day'),
                                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF6B7280)),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            pickupDateFormatted,
                                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      flex: 4,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            AppLanguage().tr(mr: 'पिकअप वेळ', en: 'Pickup Time'),
                                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF6B7280)),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            currentPickup.pickupSlot.isNotEmpty ? currentPickup.pickupSlot : AppLanguage().tr(mr: 'लवकरच', en: 'Soon'),
                                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      flex: 5,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            AppLanguage().tr(mr: 'उत्पादन व माल', en: 'Product & Qty'),
                                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF6B7280)),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${currentPickup.productName} • ${currentPickup.quantity} ${currentPickup.unit}',
                                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      flex: 4,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            AppLanguage().tr(mr: 'एकूण रक्कम', en: 'Total Amount'),
                                            style: const TextStyle(fontSize: 9.5, color: Color(0xFF6B7280)),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '₹ ${_formatRupees(currentPickup.totalAmount)}',
                                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),

                                // Action Buttons (Call Driver & View Order Details)
                                Row(
                                  children: [
                                    Expanded(
                                      child: OutlinedButton.icon(
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: const Color(0xFF2563EB),
                                          side: const BorderSide(color: Color(0xFF2563EB)),
                                          padding: const EdgeInsets.symmetric(vertical: 9),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        icon: const Icon(Icons.phone_rounded, size: 15),
                                        label: Text(
                                          AppLanguage().tr(mr: 'कॉल करा', en: 'Call Driver'),
                                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                                        ),
                                        onPressed: () => _makePhoneCall(phoneToCall),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF16A34A),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(vertical: 9),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        icon: const Icon(Icons.receipt_long_rounded, size: 15),
                                        label: Text(
                                          AppLanguage().tr(mr: 'तपशील पहा', en: 'View Details'),
                                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                                        ),
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => OrderDetailScreen(orderId: currentPickup.id),
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            );
                          })
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              const SizedBox(height: 6),
                              const Icon(Icons.local_shipping_outlined, size: 36, color: Color(0xFF94A3B8)),
                              const SizedBox(height: 8),
                              Text(
                                AppLanguage().tr(
                                  mr: 'सध्या ड्रायव्हर असाइन केलेला पिकअप नाही',
                                  en: 'No driver assigned for pickup yet',
                                ),
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                AppLanguage().tr(
                                  mr: 'ड्रायव्हर असाइन झाल्यानंतर पिकअप दिनांक, वेळ, ड्रायव्हर संपर्क व स्थिती येथे दिसेल.',
                                  en: 'Pickup date, time, driver info & live status will appear here once driver is assigned.',
                                ),
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 10.5, color: Color(0xFF6B7280), height: 1.3),
                              ),
                              const SizedBox(height: 8),
                              OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF16A34A),
                                  side: const BorderSide(color: Color(0xFF16A34A)),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                icon: const Icon(Icons.list_alt_rounded, size: 14),
                                label: Text(
                                  AppLanguage().tr(mr: 'सर्व ऑर्डर्स तपासा', en: 'Check All Orders'),
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                                onPressed: () => MainShell.setTab(context, 2),
                              ),
                            ],
                          ),
                  ),
                ),

                // 7. 💰 REAL EARNINGS (उत्पन्न तपशील - Period Filter)
                _sectionHeader(
                  icon: Icons.account_balance_wallet_rounded,
                  iconColor: const Color(0xFF16A34A),
                  title: 'Earnings Overview',
                  marathiTitle: 'उत्पन्न तपशील',
                  actionLabel: 'Passbook →',
                  marathiActionLabel: 'पासबुक पहा →',
                  onAction: () => MainShell.setTab(context, 3),
                ),
                if (!state.ordersReady)
                  const _SectionSkeleton(height: 160)
                else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: _EarningsCardsWithFilter(
                    settledOrders: settledOrders,
                    liveOrders: liveOrders,
                  ),
                ),

                // 8. 📈 REAL EARNINGS TREND — LINE CHART (Date Filter)
                _sectionHeader(
                  icon: Icons.show_chart_rounded,
                  iconColor: const Color(0xFF16A34A),
                  title: 'Earnings Trend',
                  marathiTitle: 'उत्पन्न कल',
                ),
                if (!state.ordersReady)
                  const _SectionSkeleton(height: 220)
                else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: _EarningsTrendLineChart(
                    orders: settledOrders,
                    totalEarned: totalEarned,
                    monthlyEarned: monthlyEarned,
                  ),
                ),

                // 10. ⚠️ REAL PRODUCT-WISE REJECTION % CHART (Date + Product + Grade Filters)
                _sectionHeader(
                  icon: Icons.donut_large_rounded,
                  iconColor: const Color(0xFFDC2626),
                  title: 'Product Rejection %',
                  marathiTitle: 'नाकारलेले शेतमाल',
                ),
                if (!state.productsReady || !state.ordersReady)
                  const _SectionSkeleton(height: 220)
                else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: _ProductRejectionRateChart(
                    products: products,
                    orders: liveOrders,
                  ),
                ),

                // 11. 🌾 REAL CROP-WISE PRODUCTION — BAR CHART
                _sectionHeader(
                  icon: Icons.grass_rounded,
                  iconColor: const Color(0xFF059669),
                  title: 'Crop Production',
                  marathiTitle: 'पिकानुसार उत्पादन',
                ),
                if (!state.cropsReady)
                  const _SectionSkeleton(height: 200)
                else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: _CropProductionBarChart(
                    crops: crops,
                  ),
                ),

                // 13. 🏛️ REAL GOVERNMENT SCHEMES (शासकीय योजना व अनुदान)
                _sectionHeader(
                  icon: Icons.account_balance_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  title: 'Government Schemes',
                  marathiTitle: 'शासकीय योजना',
                  actionLabel: 'All Schemes →',
                  marathiActionLabel: 'सर्व योजना →',
                  onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SchemesScreen())),
                ),
                if (!state.schemesReady)
                  const _SectionSkeleton(height: 140)
                else
                SizedBox(
                  height: 140,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: state.schemes.isNotEmpty
                        ? state.schemes.take(4).map((s) => _SchemeMiniCard(
                              title: s.title,
                              benefit: s.subsidyPercent.isNotEmpty ? s.subsidyPercent : s.maxAmount,
                              category: s.category,
                              color: const Color(0xFF16A34A),
                              bgColor: const Color(0xFFF0FDF4),
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SchemesScreen())),
                            )).toList()
                        : [
                            _SchemeMiniCard(
                              title: AppLanguage().tr(mr: 'पीएम-किसान निधी', en: 'PM-Kisan Nidhi'),
                              benefit: AppLanguage().tr(mr: '₹ ६,००० / वर्ष', en: '₹ 6,000 / year'),
                              category: AppLanguage().tr(mr: 'थेट बँक खात्यात हप्ता', en: 'Direct Bank Transfer'),
                              color: const Color(0xFF16A34A),
                              bgColor: const Color(0xFFF0FDF4),
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SchemesScreen())),
                            ),
                            const SizedBox(width: 10),
                            _SchemeMiniCard(
                              title: AppLanguage().tr(mr: 'महाडीबीटी ठिबक सिंचन', en: 'MahaDBT Drip Irrigation'),
                              benefit: AppLanguage().tr(mr: '८०% अनुदान', en: '80% Subsidy'),
                              category: AppLanguage().tr(mr: 'सिंचन साहित्य सहाय्य', en: 'Irrigation Equipment Support'),
                              color: const Color(0xFF2563EB),
                              bgColor: const Color(0xFFEFF6FF),
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SchemesScreen())),
                            ),
                            const SizedBox(width: 10),
                            _SchemeMiniCard(
                              title: AppLanguage().tr(mr: 'पीक विमा योजना (PMFBY)', en: 'Crop Insurance (PMFBY)'),
                              benefit: AppLanguage().tr(mr: '₹ १ मध्ये विमा', en: 'Insurance @ ₹ 1'),
                              category: AppLanguage().tr(mr: 'हवामान नुकसान भरपाई', en: 'Weather Risk Compensation'),
                              color: const Color(0xFFD97706),
                              bgColor: const Color(0xFFFFFBEB),
                              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SchemesScreen())),
                            ),
                          ],
                  ),
                ),

                // 9. 🔔 REAL NOTIFICATIONS (महत्त्वाच्या सूचना)
                _sectionHeader(
                  icon: Icons.notifications_active_rounded,
                  iconColor: const Color(0xFFDC2626),
                  title: 'Notifications',
                  marathiTitle: 'महत्त्वाच्या सूचना',
                  actionLabel: 'All Notifications →',
                  marathiActionLabel: 'सर्व सूचना →',
                  onAction: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                  child: InkWell(
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: Color(0xFFFEF2F2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.notifications_rounded, color: Color(0xFFDC2626), size: 20),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  state.notifications.isNotEmpty
                                      ? state.notifications.first.title
                                      : (liveOrders.isNotEmpty
                                          ? AppLanguage().tr(
                                              mr: 'ऑर्डर #${liveOrders.first.orderCode.isNotEmpty ? liveOrders.first.orderCode : liveOrders.first.id} अपडेट: ${liveOrders.first.status}',
                                              en: 'Order #${liveOrders.first.orderCode.isNotEmpty ? liveOrders.first.orderCode : liveOrders.first.id} update: ${liveOrders.first.status}',
                                            )
                                          : (kycVerified
                                              ? AppLanguage().tr(
                                                  mr: 'आपले शेतकरी खाते व केवायसी पडताळणी पूर्ण झाली आहे.',
                                                  en: 'Your farmer account & KYC verification is complete.',
                                                )
                                              : AppLanguage().tr(
                                                  mr: 'केवायसी व बँक पडताळणीसाठी कागदपत्रे अपलोड करा.',
                                                  en: 'Upload documents for KYC & bank verification.',
                                                ))),
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  state.notifications.isNotEmpty
                                      ? state.notifications.first.body
                                      : (liveOrders.isNotEmpty
                                          ? '${liveOrders.first.productName} • ${AppLanguage().tr(mr: "एकूण", en: "Total")} ₹ ${_formatRupees(liveOrders.first.totalAmount)}'
                                          : AppLanguage().tr(
                                              mr: 'नवीन ऑर्डर्स, हवामान आणि पेमेंट सूचनांसाठी येथे टॅप करा.',
                                              en: 'Tap here for new orders, weather & payment alerts.',
                                            )),
                                  style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF), size: 20),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          ),
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION HEADER HELPER
  // ---------------------------------------------------------------------------
  Widget _sectionHeader({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String marathiTitle,
    String? actionLabel,
    String? marathiActionLabel,
    VoidCallback? onAction,
  }) {
    final lang = AppLanguage();
    final displayTitle = lang.tr(mr: marathiTitle, en: title);
    final displayAction = actionLabel != null
        ? lang.tr(mr: marathiActionLabel ?? actionLabel, en: actionLabel)
        : null;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                Icon(icon, size: 16, color: iconColor),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    displayTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF111827),
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (displayAction != null && onAction != null) ...[
            const SizedBox(width: 8),
            InkWell(
              onTap: onAction,
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                child: Text(
                  displayAction,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF16A34A),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _getCropEmoji(String cropName) {
    final name = cropName.toLowerCase();
    if (name.contains('tomat') || name.contains('टोमॅटो')) return '🍅';
    if (name.contains('chill') || name.contains('मिरची') || name.contains('mirchi')) return '🌶️';
    if (name.contains('maize') || name.contains('मका') || name.contains('corn')) return '🌽';
    if (name.contains('onion') || name.contains('कांदा')) return '🧅';
    if (name.contains('potato') || name.contains('बटाटा')) return '🥔';
    if (name.contains('cotton') || name.contains('कापूस')) return '🌾';
    if (name.contains('soybean') || name.contains('सोयाबीन')) return '🌱';
    if (name.contains('wheat') || name.contains('गहू')) return '🌾';
    if (name.contains('rice') || name.contains('तांदूळ') || name.contains('भात')) return '🌾';
    if (name.contains('sugar') || name.contains('ऊस')) return '🎋';
    if (name.contains('garlic') || name.contains('लसूण')) return '🧄';
    if (name.contains('ginger') || name.contains('आले')) return '🫚';
    return '🌿';
  }


  static String _formatRupees(double val) {
    final intVal = val.toInt();
    if (intVal >= 1000) {
      final s = intVal.toString();
      final lastThree = s.substring(s.length - 3);
      final rest = s.substring(0, s.length - 3);
      return '${rest.replaceAllMapped(RegExp(r'\B(?=(\d{2})+(?!\d))'), (match) => ',')},$lastThree';
    }
    return intVal.toString();
  }
}

// ---------------------------------------------------------------------------
// SUB-WIDGETS & CARDS
// ---------------------------------------------------------------------------


class _EarningsMetricCard extends StatelessWidget {
  final String label;
  final String amount;
  final IconData icon;
  final Color color;
  final Color bgColor;

  const _EarningsMetricCard({
    required this.label,
    required this.amount,
    required this.icon,
    required this.color,
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
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
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(6)),
                child: Icon(icon, size: 11, color: color),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(fontSize: 9, color: Color(0xFF6B7280), fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            amount,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w900, color: Color(0xFF111827)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _SchemeMiniCard extends StatelessWidget {
  final String title;
  final String benefit;
  final String category;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  const _SchemeMiniCard({
    required this.title,
    required this.benefit,
    required this.category,
    required this.color,
    required this.bgColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: 150,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
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
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                benefit,
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF111827), height: 1.2),
            ),
            const Spacer(),
            Text(
              category,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 8.5, color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(
                  AppLanguage().tr(mr: 'अर्ज करा', en: 'Apply Now'),
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: color),
                ),
                const SizedBox(width: 2),
                Icon(Icons.arrow_forward_rounded, size: 10, color: color),
              ],
            ),
          ],
        ),
      ),
    );
  }
}


class _OverviewStatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String label;
  final String value;
  final VoidCallback? onTap;

  const _OverviewStatCard({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.label,
    required this.value,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(8),
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
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Icon(icon, size: 13, color: iconColor),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 9,
                    color: Color(0xFF6B7280),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827),
            ),
          ),
        ],
      ),
    ),
    ),
    );
  }
}


// ---------------------------------------------------------------------------
// HELPER METHODS PRESERVED
// ---------------------------------------------------------------------------

/// Statuses between "ready" and completion (driver assignment, pickup, transit, centre
/// receipt, quality check). The order stays "Ready" on the dashboard until it completes.
const Set<String> _pickupStageStatuses = {
  'READY_FOR_PICKUP',
  'DRIVER_ASSIGNED',
  'DISPATCHED',
  'DRIVER_ARRIVED',
  'ORDER_VERIFIED',
  'QR_VERIFIED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED_AT_CENTRE',
  'COLLECTION_CENTRE_RECEIVED',
  'INSPECTION',
  'GRADING',
  'GRADE_CONFIRMED',
};

String _orderStatusBucket(FarmerOrderItem order) {
  final s = order.status.trim().toUpperCase();
  if (s.startsWith('DELETED')) return '';
  if (s.contains('REJECT') || s.contains('CANCEL')) return 'rejected';
  if (s.contains('COMPLET') || s.contains('DELIVER')) return 'completed';
  if (s.contains('READY') || _pickupStageStatuses.contains(s) || order.isDriverAssigned) return 'ready';
  if (s == 'PREPARING' || s == 'PACKING') return 'preparing';
  if (s == 'ACCEPTED' || s == 'CONFIRMED') return 'accepted';
  if (s == 'NEW' || s == 'PENDING') return 'new';
  return '';
}

bool _isEarningOrder(FarmerOrderItem order) {
  final status = order.status.trim().toUpperCase();
  final quality = order.qualityStatus.trim().toUpperCase();
  if (status.contains('REJECT') || status.contains('CANCEL') || status.contains('DELETED')) return false;
  const open = {
    'PREPARING',
    'NEW',
    'PENDING',
    'CONFIRMED',
    'ACCEPTED',
    'READY_FOR_PICKUP',
    'IN_TRANSIT',
    'INSPECTION',
    'PACKING',
  };
  if (open.contains(status)) return false;
  return status.contains('COMPLET') ||
      status.contains('DELIVER') ||
      status == 'RECEIVED' ||
      status.contains('GRADE_CONFIRM') ||
      quality.contains('COMPLET') ||
      quality.contains('GRADE_CONFIRM');
}

bool _isPaidOrder(FarmerOrderItem order) {
  final status = order.paymentStatus.trim().toUpperCase();
  return status == 'PAID' || status == 'PAYMENT_COMPLETED' || status == 'COMPLETED' || status == 'PAYMENT RECEIVED';
}

double _orderAmount(FarmerOrderItem order) {
  if (order.totalAmount > 0) return order.totalAmount;
  return order.effectiveTotalAmount;
}

// ---------------------------------------------------------------------------
// 5 FILTERABLE DASHBOARD SECTIONS & CARDS
// 1. Weather Forecast Card (Today / Tomorrow / 7 Days)
// 2. Earnings Cards (Period: All Time / This Month / This Week / Today)
// 3. Earnings Trend Line Chart (Date: 7 Days / 14 Days / 30 Days / 6 Months / 1 Year)
// 4. Orders Status Bar Chart (Date + Order Type)
// 5. Product Rejection Rate Donut Chart (Date + Product + Grade)
// ---------------------------------------------------------------------------

// 2. 💰 EARNINGS CARDS WITH PERIOD FILTER (All Time / This Month / This Week / Today)
class _EarningsCardsWithFilter extends StatefulWidget {
  final List<FarmerOrderItem> settledOrders;
  final List<FarmerOrderItem> liveOrders;

  const _EarningsCardsWithFilter({
    required this.settledOrders,
    required this.liveOrders,
  });

  @override
  State<_EarningsCardsWithFilter> createState() => _EarningsCardsWithFilterState();
}

class _EarningsCardsWithFilterState extends State<_EarningsCardsWithFilter> {
  int _selectedPeriod = 0; // 0: All Time, 1: This Month, 2: This Week, 3: Today

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final startOfToday = DateTime(now.year, now.month, now.day);
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final startOfWeekDate = DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);

    List<FarmerOrderItem> filterByPeriod(List<FarmerOrderItem> source) {
      if (_selectedPeriod == 0) return source; // All Time
      return source.where((o) {
        if (o.createdAt.isEmpty) return true;
        try {
          final d = DateTime.parse(o.createdAt);
          if (_selectedPeriod == 3) {
            // Today
            return d.isAfter(startOfToday) || (d.year == now.year && d.month == now.month && d.day == now.day);
          } else if (_selectedPeriod == 2) {
            // This Week
            return d.isAfter(startOfWeekDate);
          } else if (_selectedPeriod == 1) {
            // This Month
            return d.year == now.year && d.month == now.month;
          }
          return true;
        } catch (_) {
          return true;
        }
      }).toList();
    }

    final filteredSettled = filterByPeriod(widget.settledOrders);
    final filteredLive = filterByPeriod(widget.liveOrders);

    final totalEarned = filteredSettled.fold<double>(0, (sum, o) => sum + _orderAmount(o));
    final pendingEarned = filteredSettled.where((o) => !_isPaidOrder(o)).fold<double>(0, (sum, o) => sum + _orderAmount(o));
    final paidEarned = filteredLive.where(_isPaidOrder).fold<double>(0, (sum, o) => sum + _orderAmount(o));

    final thisMonthOrders = widget.settledOrders.where((o) {
      if (o.createdAt.isEmpty) return true;
      try {
        final d = DateTime.parse(o.createdAt);
        return d.year == now.year && d.month == now.month;
      } catch (_) {
        return true;
      }
    }).toList();
    final monthlyEarned = thisMonthOrders.fold<double>(0, (sum, o) => sum + _orderAmount(o));

    final periodLabel = _selectedPeriod == 0
        ? AppLanguage().tr(mr: 'एकूण', en: 'All Time')
        : (_selectedPeriod == 1
            ? AppLanguage().tr(mr: 'या महिना', en: 'This Month')
            : (_selectedPeriod == 2
                ? AppLanguage().tr(mr: 'हा आठवडा', en: 'This Week')
                : AppLanguage().tr(mr: 'आज', en: 'Today')));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Filter Chips Row
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _periodFilterChip(0, AppLanguage().tr(mr: 'एकूण', en: 'All Time')),
              const SizedBox(width: 6),
              _periodFilterChip(1, AppLanguage().tr(mr: 'या महिना', en: 'This Month')),
              const SizedBox(width: 6),
              _periodFilterChip(2, AppLanguage().tr(mr: 'हा आठवडा', en: 'This Week')),
              const SizedBox(width: 6),
              _periodFilterChip(3, AppLanguage().tr(mr: 'आज', en: 'Today')),
            ],
          ),
        ),
        const SizedBox(height: 10),
        // 4 Cards Grid
        Row(
          children: [
            Expanded(
              child: _EarningsMetricCard(
                label: periodLabel,
                amount: '₹ ${_DashboardScreenState._formatRupees(totalEarned)}',
                icon: Icons.account_balance_wallet,
                color: const Color(0xFF16A34A),
                bgColor: const Color(0xFFDCFCE7),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _EarningsMetricCard(
                label: AppLanguage().tr(mr: 'या महिन्याचे', en: 'Monthly'),
                amount: '₹ ${_DashboardScreenState._formatRupees(monthlyEarned)}',
                icon: Icons.calendar_today_rounded,
                color: const Color(0xFF2563EB),
                bgColor: const Color(0xFFDBEAFE),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _EarningsMetricCard(
                label: AppLanguage().tr(mr: 'प्रलंबित रक्कम', en: 'Pending'),
                amount: '₹ ${_DashboardScreenState._formatRupees(pendingEarned)}',
                icon: Icons.hourglass_top_rounded,
                color: const Color(0xFFD97706),
                bgColor: const Color(0xFFFEF3C7),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _EarningsMetricCard(
                label: AppLanguage().tr(mr: 'खात्यात जमा', en: 'Paid'),
                amount: '₹ ${_DashboardScreenState._formatRupees(paidEarned)}',
                icon: Icons.verified_rounded,
                color: const Color(0xFF059669),
                bgColor: const Color(0xFFD1FAE5),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _periodFilterChip(int index, String label) {
    final isSel = _selectedPeriod == index;
    return InkWell(
      onTap: () => setState(() => _selectedPeriod = index),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF16A34A) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSel ? const Color(0xFF16A34A) : const Color(0xFFD1D5DB),
          ),
          boxShadow: isSel
              ? [
                  BoxShadow(
                    color: const Color(0xFF16A34A).withValues(alpha: 0.2),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
            color: isSel ? Colors.white : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }
}

// 3. 📈 EARNINGS TREND LINE CHART WITH DATE FILTER
class _EarningsTrendLineChart extends StatefulWidget {
  final List<FarmerOrderItem> orders;
  final double totalEarned;
  final double monthlyEarned;

  const _EarningsTrendLineChart({
    required this.orders,
    required this.totalEarned,
    required this.monthlyEarned,
  });

  @override
  State<_EarningsTrendLineChart> createState() => _EarningsTrendLineChartState();
}

class _EarningsTrendLineChartState extends State<_EarningsTrendLineChart> {
  int _selectedDateFilter = 0; // 0: 7 Days, 1: 14 Days, 2: 30 Days, 3: 6 Months, 4: 1 Year

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final List<({String label, double amount})> pointsData = [];
    final monthNames = AppLanguage().isMarathi ? ['जाने', 'फेब्रु', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (_selectedDateFilter == 0) {
      // Last 7 Days
      for (int i = 6; i >= 0; i--) {
        final d = now.subtract(Duration(days: i));
        final dayLabel = '${d.day} ${_getShortMonth(d.month)}';
        final sum = widget.orders.where((o) {
          if (o.createdAt.isEmpty) return false;
          try {
            final od = DateTime.parse(o.createdAt);
            return od.year == d.year && od.month == d.month && od.day == d.day;
          } catch (_) {
            return false;
          }
        }).fold<double>(0.0, (acc, o) => acc + _orderAmount(o));
        pointsData.add((label: dayLabel, amount: sum));
      }
    } else if (_selectedDateFilter == 1) {
      // Last 14 Days (7 intervals of 2 days)
      for (int i = 6; i >= 0; i--) {
        final d = now.subtract(Duration(days: i * 2));
        final dayLabel = '${d.day} ${_getShortMonth(d.month)}';
        final sum = widget.orders.where((o) {
          if (o.createdAt.isEmpty) return false;
          try {
            final od = DateTime.parse(o.createdAt);
            final diff = now.difference(od).inDays;
            return diff >= (i * 2) && diff < (i * 2 + 2);
          } catch (_) {
            return false;
          }
        }).fold<double>(0.0, (acc, o) => acc + _orderAmount(o));
        pointsData.add((label: dayLabel, amount: sum));
      }
    } else if (_selectedDateFilter == 2) {
      // Last 30 Days (6 intervals of 5 days)
      for (int i = 5; i >= 0; i--) {
        final d = now.subtract(Duration(days: i * 5));
        final dayLabel = '${d.day} ${_getShortMonth(d.month)}';
        final sum = widget.orders.where((o) {
          if (o.createdAt.isEmpty) return false;
          try {
            final od = DateTime.parse(o.createdAt);
            final diff = now.difference(od).inDays;
            return diff >= (i * 5) && diff < (i * 5 + 5);
          } catch (_) {
            return false;
          }
        }).fold<double>(0.0, (acc, o) => acc + _orderAmount(o));
        pointsData.add((label: dayLabel, amount: sum));
      }
    } else if (_selectedDateFilter == 3) {
      // Last 6 Months
      for (int i = 5; i >= 0; i--) {
        final monthDate = DateTime(now.year, now.month - i, 1);
        final monthName = monthNames[(monthDate.month - 1) % 12];
        final sum = widget.orders.where((o) {
          if (o.createdAt.isEmpty) return false;
          try {
            final d = DateTime.parse(o.createdAt);
            return d.year == monthDate.year && d.month == monthDate.month;
          } catch (_) {
            return false;
          }
        }).fold<double>(0.0, (acc, o) => acc + _orderAmount(o));
        pointsData.add((label: monthName, amount: sum));
      }
    } else {
      // 1 Year (6 bi-monthly points)
      for (int i = 5; i >= 0; i--) {
        final monthDate = DateTime(now.year, now.month - (i * 2), 1);
        final monthName = monthNames[(monthDate.month - 1) % 12];
        final sum = widget.orders.where((o) {
          if (o.createdAt.isEmpty) return false;
          try {
            final d = DateTime.parse(o.createdAt);
            return d.year == monthDate.year && (d.month == monthDate.month || d.month == monthDate.month + 1);
          } catch (_) {
            return false;
          }
        }).fold<double>(0.0, (acc, o) => acc + _orderAmount(o));
        pointsData.add((label: monthName, amount: sum));
      }
    }

    if (pointsData.every((m) => m.amount == 0) && widget.totalEarned > 0) {
      pointsData[pointsData.length - 1] = (label: pointsData.last.label, amount: widget.totalEarned);
    }

    final maxVal = pointsData.fold<double>(1000.0, (m, item) => item.amount > m ? item.amount : m);
    final currentSum = pointsData.fold<double>(0.0, (acc, item) => acc + item.amount);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header + Filter Selector
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppLanguage().tr(mr: 'उत्पन्न कल', en: 'Earnings Trend'),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    AppLanguage().tr(
                      mr: 'कालावधी एकूण: ₹ ${_DashboardScreenState._formatRupees(currentSum)}',
                      en: 'Period Total: ₹ ${_DashboardScreenState._formatRupees(currentSum)}',
                    ),
                    style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(Icons.trending_up_rounded, size: 13, color: Color(0xFF16A34A)),
                    SizedBox(width: 3),
                    Text(
                      AppLanguage().tr(mr: 'थेट कल', en: 'Live Trend'),
                      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Date Filter Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _trendFilterPill(0, '7 Days', '७ दिवस'),
                const SizedBox(width: 5),
                _trendFilterPill(1, '14 Days', '१४ दिवस'),
                const SizedBox(width: 5),
                _trendFilterPill(2, '30 Days', '३० दिवस'),
                const SizedBox(width: 5),
                _trendFilterPill(3, '6 Months', '६ महिने'),
                const SizedBox(width: 5),
                _trendFilterPill(4, '1 Year', '१ वर्ष'),
              ],
            ),
          ),

          const SizedBox(height: 10),

          // Line Chart
          SizedBox(
            height: 130,
            width: double.infinity,
            child: CustomPaint(
              painter: _EarningsLinePainter(
                data: pointsData.map((m) => m.amount).toList(),
                labels: pointsData.map((m) => m.label).toList(),
                maxVal: maxVal,
              ),
            ),
          ),

          const SizedBox(height: 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLanguage().tr(
                  mr: 'एकूण उत्पन्न: ₹ ${_DashboardScreenState._formatRupees(widget.totalEarned)}',
                  en: 'Total Earnings: ₹ ${_DashboardScreenState._formatRupees(widget.totalEarned)}',
                ),
                style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
              ),
              Text(
                _selectedDateFilter == 0
                    ? AppLanguage().tr(mr: 'गेले ७ दिवस', en: 'Last 7 Days')
                    : (_selectedDateFilter == 1
                        ? AppLanguage().tr(mr: 'गेले १४ दिवस', en: 'Last 14 Days')
                        : (_selectedDateFilter == 2
                            ? AppLanguage().tr(mr: 'गेले ३० दिवस', en: 'Last 30 Days')
                            : (_selectedDateFilter == 3
                                ? AppLanguage().tr(mr: 'गेले ६ महिने', en: 'Last 6 Months')
                                : AppLanguage().tr(mr: 'गेले १ वर्ष', en: 'Last 1 Year')))),
                style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _getShortMonth(int month) {
    const mrList = ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'];
    const enList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final list = AppLanguage().isMarathi ? mrList : enList;
    return list[(month - 1) % 12];
  }

  Widget _trendFilterPill(int index, String en, String mr) {
    final isSel = _selectedDateFilter == index;
    return InkWell(
      onTap: () => setState(() => _selectedDateFilter = index),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF16A34A) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          AppLanguage().tr(mr: mr, en: en),
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
            color: isSel ? Colors.white : const Color(0xFF4B5563),
          ),
        ),
      ),
    );
  }
}

// 4. 📦 ORDERS STATUS BAR CHART WITH DATE + ORDER TYPE FILTERS
class _OrderStatusBaChart extends StatefulWidget {
  final List<FarmerOrderItem> orders;

  const _OrderStatusBaChart({required this.orders});

  @override
  State<_OrderStatusBaChart> createState() => _OrderStatusBaChartState();
}

class _OrderStatusBaChartState extends State<_OrderStatusBaChart> {
  int _selectedDate = 0; // 0: All Time, 1: Today, 2: This Week, 3: This Month, 4: 30 Days
  String _selectedType = 'ALL'; // 'ALL', 'HARVEST', 'DIRECT', 'REGULAR', 'CONTRACT'

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final startOfToday = DateTime(now.year, now.month, now.day);
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final startOfWeekDate = DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);
    final thirtyDaysAgo = now.subtract(const Duration(days: 30));

    // Filter by Date
    final dateFiltered = widget.orders.where((o) {
      if (_selectedDate == 0) return true; // All Time
      if (o.createdAt.isEmpty) return true;
      try {
        final d = DateTime.parse(o.createdAt);
        if (_selectedDate == 1) {
          return d.isAfter(startOfToday) || (d.year == now.year && d.month == now.month && d.day == now.day);
        } else if (_selectedDate == 2) {
          return d.isAfter(startOfWeekDate);
        } else if (_selectedDate == 3) {
          return d.year == now.year && d.month == now.month;
        } else if (_selectedDate == 4) {
          return d.isAfter(thirtyDaysAgo);
        }
        return true;
      } catch (_) {
        return true;
      }
    }).toList();

    // Filter by Order Type
    final filtered = dateFiltered.where((o) {
      if (_selectedType == 'ALL') return true;
      final tag = '${o.buyerName} ${o.cropName} ${o.productName} ${o.variety} ${o.collectionCentre}'.toUpperCase();
      if (_selectedType == 'HARVEST') return tag.contains('HARVEST') || tag.contains('काढणी') || o.pickupSlot.toUpperCase().contains('HARVEST');
      if (_selectedType == 'DIRECT') return tag.contains('DIRECT') || tag.contains('थेट') || o.collectionCentre.isNotEmpty;
      if (_selectedType == 'CONTRACT') return tag.contains('CONTRACT') || tag.contains('करार');
      if (_selectedType == 'REGULAR') return true;
      return true;
    }).toList();

    final buckets = filtered.map(_orderStatusBucket).toList();
    int countOf(String bucket) => buckets.where((b) => b == bucket).length;

    final newCount = countOf('new');
    final acceptedCount = countOf('accepted');
    final preparingCount = countOf('preparing');
    final readyCount = countOf('ready');
    final completedCount = countOf('completed');
    final rejectedCount = countOf('rejected');

    final total = newCount + acceptedCount + preparingCount + readyCount + completedCount + rejectedCount;
    final maxCount = [newCount, acceptedCount, preparingCount, readyCount, completedCount, rejectedCount]
        .fold<int>(1, (m, c) => c > m ? c : m);

    final items = [
      (label: AppLanguage().tr(mr: 'नवीन', en: 'New'), count: newCount, color: const Color(0xFF2563EB)),
      (label: AppLanguage().tr(mr: 'स्वीकृत', en: 'Acpt'), count: acceptedCount, color: const Color(0xFF0284C7)),
      (label: AppLanguage().tr(mr: 'तयार', en: 'Prep'), count: preparingCount, color: const Color(0xFFD97706)),
      (label: AppLanguage().tr(mr: 'उचल', en: 'Ready'), count: readyCount, color: const Color(0xFF7C3AED)),
      (label: AppLanguage().tr(mr: 'पूर्ण', en: 'Done'), count: completedCount, color: const Color(0xFF16A34A)),
      (label: AppLanguage().tr(mr: 'नाकार', en: 'Rej'), count: rejectedCount, color: const Color(0xFFDC2626)),
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title + Total Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLanguage().tr(mr: 'ऑर्डर स्थिती वितरण', en: 'Orders Status Distribution'),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  AppLanguage().tr(mr: 'एकूण: $total', en: 'Total: $total'),
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF374151)),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Filter Row 1: Date Filter
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _dateChip(0, AppLanguage().tr(mr: 'सर्व', en: 'All Time')),
                const SizedBox(width: 5),
                _dateChip(1, AppLanguage().tr(mr: 'आज', en: 'Today')),
                const SizedBox(width: 5),
                _dateChip(2, AppLanguage().tr(mr: 'आठवडा', en: 'This Week')),
                const SizedBox(width: 5),
                _dateChip(3, AppLanguage().tr(mr: 'महिना', en: 'This Month')),
                const SizedBox(width: 5),
                _dateChip(4, AppLanguage().tr(mr: '३० दिवस', en: '30 Days')),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Filter Row 2: Order Type Filter
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _typeChip('ALL', AppLanguage().tr(mr: 'सर्व प्रकार', en: 'All Types')),
                const SizedBox(width: 5),
                _typeChip('HARVEST', AppLanguage().tr(mr: '🌾 काढणी', en: '🌾 Harvest')),
                const SizedBox(width: 5),
                _typeChip('DIRECT', AppLanguage().tr(mr: '🏪 थेट विक्री', en: '🏪 Direct')),
                const SizedBox(width: 5),
                _typeChip('REGULAR', AppLanguage().tr(mr: '📦 नियमित', en: '📦 Regular')),
                const SizedBox(width: 5),
                _typeChip('CONTRACT', AppLanguage().tr(mr: '📝 करार', en: '📝 Contract')),
              ],
            ),
          ),

          const SizedBox(height: 10),

          // Bar Chart Columns
          SizedBox(
            height: 146,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: items.map((item) {
                final barHeight = maxCount > 0 ? (item.count / maxCount * 70).clamp(6.0, 70.0) : 6.0;
                return Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${item.count}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: item.count > 0 ? item.color : const Color(0xFF9CA3AF),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        height: barHeight,
                        width: 24,
                        decoration: BoxDecoration(
                          color: item.count > 0 ? item.color : const Color(0xFFE5E7EB),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
                          gradient: item.count > 0
                              ? LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    item.color,
                                    item.color.withValues(alpha: 0.7),
                                  ],
                                )
                              : null,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dateChip(int index, String label) {
    final isSel = _selectedDate == index;
    return InkWell(
      onTap: () => setState(() => _selectedDate = index),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF2563EB) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
            color: isSel ? Colors.white : const Color(0xFF4B5563),
          ),
        ),
      ),
    );
  }

  Widget _typeChip(String type, String label) {
    final isSel = _selectedType == type;
    return InkWell(
      onTap: () => setState(() => _selectedType = type),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF059669) : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isSel ? const Color(0xFF059669) : const Color(0xFFE5E7EB)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
            color: isSel ? Colors.white : const Color(0xFF4B5563),
          ),
        ),
      ),
    );
  }
}

// 5. ❌ PRODUCT REJECTION % DONUT CHART WITH DATE + PRODUCT + GRADE FILTERS
class _ProductRejectionRateChart extends StatefulWidget {
  final List<ProductItem> products;
  final List<FarmerOrderItem> orders;

  const _ProductRejectionRateChart({
    required this.products,
    required this.orders,
  });

  @override
  State<_ProductRejectionRateChart> createState() => _ProductRejectionRateChartState();
}

class _ProductRejectionRateChartState extends State<_ProductRejectionRateChart> {
  int _selectedDate = 0; // 0: All Time, 1: This Month, 2: 30 Days, 3: 90 Days
  String _selectedProduct = 'ALL'; // 'ALL' or Product Name
  String _selectedGrade = 'ALL'; // 'ALL', 'GRADE_A', 'GRADE_B', 'GRADE_C'

  @override
  Widget build(BuildContext context) {
    if (widget.products.isEmpty && widget.orders.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          children: [
            Icon(Icons.donut_large_rounded, size: 30, color: Color(0xFF94A3B8)),
            SizedBox(height: 6),
            Text(
              AppLanguage().tr(mr: 'कोणतीही उत्पादने किंवा ऑर्डर्स नोंदवलेली नाहीत', en: 'No products or orders recorded'),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF374151)),
            ),
          ],
        ),
      );
    }

    final now = DateTime.now();
    final thirtyDaysAgo = now.subtract(const Duration(days: 30));
    final ninetyDaysAgo = now.subtract(const Duration(days: 90));

    // 1. Filter Orders by Date
    final dateFilteredOrders = widget.orders.where((o) {
      if (_selectedDate == 0) return true; // All Time
      if (o.createdAt.isEmpty) return true;
      try {
        final d = DateTime.parse(o.createdAt);
        if (_selectedDate == 1) return d.year == now.year && d.month == now.month;
        if (_selectedDate == 2) return d.isAfter(thirtyDaysAgo);
        if (_selectedDate == 3) return d.isAfter(ninetyDaysAgo);
        return true;
      } catch (_) {
        return true;
      }
    }).toList();

    // 2. Filter Orders by Grade (if specified)
    final gradeFilteredOrders = dateFilteredOrders.where((o) {
      if (_selectedGrade == 'ALL') return true;
      if (_selectedGrade == 'GRADE_A') return o.gradeAQty > 0 || o.gradeARejected > 0 || o.placedAQty > 0;
      if (_selectedGrade == 'GRADE_B') return o.gradeBQty > 0 || o.gradeBRejected > 0 || o.placedBQty > 0;
      if (_selectedGrade == 'GRADE_C') return o.gradeCQty > 0 || o.gradeCRejected > 0 || o.placedCQty > 0;
      return true;
    }).toList();

    // 3. Filter Products by selected product
    final effectiveProducts = _selectedProduct == 'ALL'
        ? widget.products
        : widget.products.where((p) => p.productName.trim().toLowerCase() == _selectedProduct.trim().toLowerCase()).toList();

    final List<({String title, String category, double totalOrdered, double rejected, double rate})> list = [];

    for (final p in effectiveProducts) {
      final titleLower = p.productName.trim().toLowerCase();
      final matchedOrders = gradeFilteredOrders.where((o) {
        final cLower = o.cropName.trim().toLowerCase();
        final vLower = o.variety.trim().toLowerCase();
        return cLower.contains(titleLower) || titleLower.contains(cLower) || (vLower.isNotEmpty && titleLower.contains(vLower));
      }).toList();

      double ord = matchedOrders.fold<double>(0.0, (acc, o) => acc + o.quantity);
      double rej = matchedOrders.fold<double>(0.0, (acc, o) => acc + o.rejectedQuantity);

      if (ord == 0) {
        ord = p.stockQuantity;
      }

      final rate = ord > 0 ? (rej / ord * 100).clamp(0.0, 100.0) : 0.0;
      list.add((title: p.productName, category: p.category, totalOrdered: ord, rejected: rej, rate: rate));
    }

    final totalOrderedAll = list.fold<double>(0.0, (acc, item) => acc + item.totalOrdered);
    final totalRejectedAll = list.fold<double>(0.0, (acc, item) => acc + item.rejected);
    final overallRejectionRate = totalOrderedAll > 0 ? (totalRejectedAll / totalOrderedAll * 100).clamp(0.0, 100.0) : 0.0;
    final totalAcceptedAll = (totalOrderedAll - totalRejectedAll).clamp(0.0, double.infinity);
    final overallAcceptanceRate = (100.0 - overallRejectionRate).clamp(0.0, 100.0);

    const colors = [
      Color(0xFFEF4444),
      Color(0xFFF97316),
      Color(0xFF8B5CF6),
      Color(0xFF06B6D4),
      Color(0xFFF59E0B),
    ];

    final List<({String label, double value, Color color})> slices = [];

    slices.add((
      label: AppLanguage().tr(mr: 'मंजूर माल', en: 'Accepted'),
      value: totalAcceptedAll > 0 ? totalAcceptedAll : (totalRejectedAll == 0 ? 100.0 : 0.0),
      color: const Color(0xFF16A34A),
    ));

    int cIdx = 0;
    for (final item in list) {
      if (item.rejected > 0) {
        slices.add((
          label: item.title,
          value: item.rejected,
          color: colors[cIdx % colors.length],
        ));
        cIdx++;
      }
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title + Status Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLanguage().tr(mr: 'नाकारलेले प्रमाण %', en: 'Rejection Rate %'),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: totalRejectedAll > 0 ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  totalRejectedAll > 0
                      ? AppLanguage().tr(
                          mr: '${totalRejectedAll.toStringAsFixed(0)} Kg नाकारले',
                          en: '${totalRejectedAll.toStringAsFixed(0)} Kg Rejected',
                        )
                      : AppLanguage().tr(mr: '०% रिजेक्शन ✓', en: '0% Rejection ✓'),
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.bold,
                    color: totalRejectedAll > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Filter Row 1: Date Filter
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _dateChip(0, AppLanguage().tr(mr: 'एकूण', en: 'All Time')),
                const SizedBox(width: 5),
                _dateChip(1, AppLanguage().tr(mr: 'या महिना', en: 'This Month')),
                const SizedBox(width: 5),
                _dateChip(2, AppLanguage().tr(mr: '३० दिवस', en: '30 Days')),
                const SizedBox(width: 5),
                _dateChip(3, AppLanguage().tr(mr: '९० दिवस', en: '90 Days')),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Filter Row 2: Product Filter + Grade Filter
          Row(
            children: [
              // Product Dropdown
              Expanded(
                flex: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: _selectedProduct,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF6B7280)),
                      style: const TextStyle(fontSize: 9.5, color: Color(0xFF1F2937), fontWeight: FontWeight.bold),
                      items: [
                        DropdownMenuItem(value: 'ALL', child: Text(AppLanguage().tr(mr: 'सर्व उत्पादने', en: 'All Products'))),
                        ...widget.products.map((p) => DropdownMenuItem(
                              value: p.productName,
                              child: Text('${_DashboardScreenState._getCropEmoji(p.productName)} ${p.productName}'),
                            )),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedProduct = val);
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              // Grade Dropdown
              Expanded(
                flex: 4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: _selectedGrade,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Color(0xFF6B7280)),
                      style: const TextStyle(fontSize: 9.5, color: Color(0xFF1F2937), fontWeight: FontWeight.bold),
                      items: [
                        DropdownMenuItem(value: 'ALL', child: Text(AppLanguage().tr(mr: 'सर्व प्रत', en: 'All Grades'))),
                        DropdownMenuItem(value: 'GRADE_A', child: Text(AppLanguage().tr(mr: 'प्रत अ', en: 'Grade A'))),
                        DropdownMenuItem(value: 'GRADE_B', child: Text(AppLanguage().tr(mr: 'प्रत ब', en: 'Grade B'))),
                        DropdownMenuItem(value: 'GRADE_C', child: Text(AppLanguage().tr(mr: 'प्रत क', en: 'Grade C'))),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedGrade = val);
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Donut Chart + Percent Breakdown
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 125,
                height: 125,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(
                      size: const Size(125, 125),
                      painter: _DonutChartPainter(
                        slices: slices,
                        strokeWidth: 16.0,
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${overallRejectionRate.toStringAsFixed(1)}%',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: overallRejectionRate > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                          ),
                        ),
                        Text(
                          overallRejectionRate > 0
                              ? AppLanguage().tr(mr: 'नाकारलेले', en: 'Rejected')
                              : AppLanguage().tr(mr: 'मंजूर माल', en: 'Accepted'),
                          style: const TextStyle(fontSize: 8.5, color: Color(0xFF6B7280), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFF16A34A),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            AppLanguage().tr(mr: 'मंजूर माल', en: 'Accepted'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
                          ),
                        ),
                        Text(
                          '${overallAcceptanceRate.toStringAsFixed(0)}%',
                          style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ...list.map((item) {
                      final hasRejection = item.rejected > 0;
                      final sIdx = slices.indexWhere((s) => s.label == item.title);
                      final dotColor = sIdx != -1 ? slices[sIdx].color : const Color(0xFF9CA3AF);

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 5),
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: hasRejection ? dotColor : const Color(0xFF9CA3AF).withValues(alpha: 0.4),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              _DashboardScreenState._getCropEmoji(item.title),
                              style: const TextStyle(fontSize: 10),
                            ),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                item.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 9, color: Color(0xFF4B5563)),
                              ),
                            ),
                            Text(
                              hasRejection ? AppLanguage().tr(mr: '${item.rejected.toStringAsFixed(0)} किलो (${item.rate.toStringAsFixed(1)}%)', en: '${item.rejected.toStringAsFixed(0)} Kg (${item.rate.toStringAsFixed(1)}%)') : AppLanguage().tr(mr: '०%', en: '0%'),
                              style: TextStyle(
                                fontSize: 8.5,
                                fontWeight: hasRejection ? FontWeight.bold : FontWeight.normal,
                                color: hasRejection ? dotColor : const Color(0xFF9CA3AF),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).take(4),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Quality Advice Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: overallRejectionRate <= 5.0 ? const Color(0xFFF0FDF4) : const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: overallRejectionRate <= 5.0 ? const Color(0xFFBBF7D0) : const Color(0xFFFDE68A),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  overallRejectionRate <= 5.0 ? Icons.check_circle_rounded : Icons.info_outline_rounded,
                  size: 13,
                  color: overallRejectionRate <= 5.0 ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    overallRejectionRate <= 5.0
                        ? AppLanguage().tr(
                            mr: 'उत्कृष्ट दर्जा! ९५%+ माल थेट मंजूर झाला आहे.',
                            en: 'Great quality! 95%+ harvest approved directly.',
                          )
                        : AppLanguage().tr(
                            mr: 'माल नाकारणे कमी करण्यासाठी काढणीनंतर योग्य प्रतवारी व पॅकिंग करा.',
                            en: 'Grade & pack properly after harvest to minimize rejection.',
                          ),
                    style: TextStyle(
                      fontSize: 8.5,
                      color: overallRejectionRate <= 5.0 ? const Color(0xFF15803D) : const Color(0xFFB45309),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dateChip(int index, String label) {
    final isSel = _selectedDate == index;
    return InkWell(
      onTap: () => setState(() => _selectedDate = index),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFFDC2626) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
            color: isSel ? Colors.white : const Color(0xFF4B5563),
          ),
        ),
      ),
    );
  }
}



class _EarningsLinePainter extends CustomPainter {
  final List<double> data;
  final List<String> labels;
  final double maxVal;

  _EarningsLinePainter({
    required this.data,
    required this.labels,
    required this.maxVal,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    final paintLine = Paint()
      ..color = const Color(0xFF16A34A)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final paintGrid = Paint()
      ..color = const Color(0xFFF3F4F6)
      ..strokeWidth = 1.0;

    final paintDotFill = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    final paintDotStroke = Paint()
      ..color = const Color(0xFF16A34A)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;

    final bottomPadding = 20.0;
    final chartHeight = size.height - bottomPadding;
    final chartWidth = size.width;

    // Draw horizontal grid lines
    for (int i = 0; i <= 3; i++) {
      final y = chartHeight * (i / 3.0);
      canvas.drawLine(Offset(0, y), Offset(chartWidth, y), paintGrid);
    }

    final count = data.length;
    final stepX = count > 1 ? chartWidth / (count - 1) : chartWidth / 2;
    final points = <Offset>[];

    for (int i = 0; i < count; i++) {
      final x = count > 1 ? i * stepX : chartWidth / 2;
      final normalized = maxVal > 0 ? (data[i] / maxVal).clamp(0.0, 1.0) : 0.0;
      final y = chartHeight - (normalized * (chartHeight - 12)) - 6;
      points.add(Offset(x, y));
    }

    // Build curved path
    final path = Path();
    final fillPath = Path();

    if (points.isNotEmpty) {
      path.moveTo(points[0].dx, points[0].dy);
      fillPath.moveTo(points[0].dx, chartHeight);
      fillPath.lineTo(points[0].dx, points[0].dy);

      for (int i = 0; i < points.length - 1; i++) {
        final p0 = points[i];
        final p1 = points[i + 1];
        final controlX1 = p0.dx + (p1.dx - p0.dx) / 2;
        final controlY1 = p0.dy;
        final controlX2 = p0.dx + (p1.dx - p0.dx) / 2;
        final controlY2 = p1.dy;

        path.cubicTo(controlX1, controlY1, controlX2, controlY2, p1.dx, p1.dy);
        fillPath.cubicTo(controlX1, controlY1, controlX2, controlY2, p1.dx, p1.dy);
      }

      fillPath.lineTo(points.last.dx, chartHeight);
      fillPath.close();

      final fillPaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF16A34A).withValues(alpha: 0.28),
            const Color(0xFF16A34A).withValues(alpha: 0.0),
          ],
        ).createShader(Rect.fromLTWH(0, 0, chartWidth, chartHeight));

      canvas.drawPath(fillPath, fillPaint);
      canvas.drawPath(path, paintLine);

      final textPainter = TextPainter(textDirection: TextDirection.ltr);

      for (int i = 0; i < points.length; i++) {
        final pt = points[i];

        canvas.drawCircle(pt, 4.5, paintDotFill);
        canvas.drawCircle(pt, 4.5, paintDotStroke);

        if (i == points.length - 1) {
          final pulsePaint = Paint()
            ..color = const Color(0xFF16A34A).withValues(alpha: 0.2)
            ..style = PaintingStyle.fill;
          canvas.drawCircle(pt, 8.0, pulsePaint);
        }

        if (i < labels.length) {
          textPainter.text = TextSpan(
            text: labels[i],
            style: TextStyle(
              fontSize: 9.5,
              color: i == points.length - 1 ? const Color(0xFF16A34A) : const Color(0xFF6B7280),
              fontWeight: i == points.length - 1 ? FontWeight.bold : FontWeight.normal,
            ),
          );
          textPainter.layout();
          textPainter.paint(
            canvas,
            Offset(pt.dx - (textPainter.width / 2), size.height - textPainter.height),
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _EarningsLinePainter oldDelegate) {
    return oldDelegate.data != data || oldDelegate.maxVal != maxVal;
  }
}

class _DonutChartPainter extends CustomPainter {
  final List<({String label, double value, Color color})> slices;
  final double strokeWidth;

  _DonutChartPainter({
    required this.slices,
    this.strokeWidth = 16.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (min(size.width, size.height) - strokeWidth) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    final total = slices.fold<double>(0.0, (acc, s) => acc + s.value);

    if (total <= 0) {
      final paint = Paint()
        ..color = const Color(0xFF16A34A)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth;
      canvas.drawCircle(center, radius, paint);
      return;
    }

    var startAngle = -pi / 2;

    for (final slice in slices) {
      if (slice.value <= 0) continue;
      final sweepAngle = (slice.value / total) * 2 * pi;

      final paint = Paint()
        ..color = slice.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;

      canvas.drawArc(rect, startAngle, sweepAngle, false, paint);
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutChartPainter oldDelegate) {
    return oldDelegate.slices != slices || oldDelegate.strokeWidth != strokeWidth;
  }
}

class _CropProductionBarChart extends StatelessWidget {
  final List<CropItem> crops;

  const _CropProductionBarChart({
    required this.crops,
  });

  @override
  Widget build(BuildContext context) {
    if (crops.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          children: [
            Icon(Icons.grass_outlined, size: 30, color: Color(0xFF94A3B8)),
            SizedBox(height: 6),
            Text(
              AppLanguage().tr(mr: 'अद्याप कोणतीही पिके नोंदवलेली नाहीत', en: 'No crops recorded yet'),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF374151)),
            ),
          ],
        ),
      );
    }

    final totalAcreage = crops.fold<double>(0.0, (acc, c) => acc + c.acreage);
    final maxAcreage = crops.fold<double>(0.1, (acc, c) => c.acreage > acc ? c.acreage : acc);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLanguage().tr(mr: 'पिकानुसार उत्पादन क्षमता', en: 'Crop Production'),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  AppLanguage().tr(
                    mr: '${totalAcreage.toStringAsFixed(1)} एकर एकूण',
                    en: '${totalAcreage.toStringAsFixed(1)} Acre Total',
                  ),
                  style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...crops.map((c) {
            final pct = totalAcreage > 0 ? (c.acreage / totalAcreage * 100) : 0.0;
            final ratio = maxAcreage > 0 ? (c.acreage / maxAcreage).clamp(0.05, 1.0) : 0.05;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text(_DashboardScreenState._getCropEmoji(c.cropName), style: const TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Text(
                            c.cropName,
                            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                          ),
                          if (c.variety.isNotEmpty) ...[
                            const SizedBox(width: 4),
                            Text(
                              '(${c.variety})',
                              style: const TextStyle(fontSize: 9.5, color: Color(0xFF6B7280)),
                            ),
                          ],
                        ],
                      ),
                      Text(
                        '${c.acreage} ${c.areaUnit} (${pct.toStringAsFixed(0)}%)',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: ratio,
                      backgroundColor: const Color(0xFFF3F4F6),
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF16A34A)),
                      minHeight: 8,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        AppLanguage().tr(
                          mr: 'अंदाजे काढणी: ${c.estHarvestDate.isNotEmpty ? c.estHarvestDate : "तारीख बाकी"}',
                          en: 'Est. Harvest: ${c.estHarvestDate.isNotEmpty ? c.estHarvestDate : "Pending"}',
                        ),
                        style: const TextStyle(fontSize: 8.5, color: Color(0xFF6B7280)),
                      ),
                      Text(
                        AppLanguage().tr(
                          mr: 'वाढ: ${(c.progress * 100).toInt()}%',
                          en: 'Growth: ${(c.progress * 100).toInt()}%',
                        ),
                        style: const TextStyle(fontSize: 8.5, color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _MarketPriceComparisonDonutCard extends StatefulWidget {
  const _MarketPriceComparisonDonutCard();

  @override
  State<_MarketPriceComparisonDonutCard> createState() => _MarketPriceComparisonDonutCardState();
}

class _MarketPriceComparisonDonutCardState extends State<_MarketPriceComparisonDonutCard> {
  int _selectedProductIndex = 0;
  int _selectedDateIndex = 0; // 0: Today, 1: Yesterday, 2: 2 Days Ago, -1: Custom Date, 3: All
  DateTime? _customDate;

  static const List<Color> _chartColors = [
    Color(0xFF16A34A), // Emerald Green
    Color(0xFF2563EB), // Blue
    Color(0xFF8B5CF6), // Purple
    Color(0xFFEA580C), // Orange
    Color(0xFF06B6D4), // Cyan
    Color(0xFFF59E0B), // Amber
    Color(0xFFDC2626), // Rose
  ];

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: MarketPriceService(),
      builder: (context, _) {
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

        final service = MarketPriceService();
        final comparisons = service.getComparisons(date: targetDate);
        if (comparisons.isEmpty && service.isLoading) {
          return _SkeletonShimmer(
            child: Container(
              height: 200,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _skeletonBox(width: 120, height: 12, borderRadius: 4),
                  const SizedBox(height: 10),
                  Expanded(child: _skeletonBox(width: double.infinity, borderRadius: 10)),
                ],
              ),
            ),
          );
        }
        if (comparisons.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: [
                _buildDateSelectorRow(),
                const SizedBox(height: 10),
                const Icon(Icons.storefront_outlined, size: 28, color: Color(0xFF94A3B8)),
                const SizedBox(height: 8),
                Text(
                  _selectedDateIndex == 0
                      ? AppLanguage().tr(
                          mr: 'आजचे बाजारभाव ॲडमिनने अजून जोडलेले नाहीत',
                          en: "Today's market prices not updated by Admin yet",
                        )
                      : (targetDate != null
                          ? AppLanguage().tr(
                              mr: '$targetDate रोजी बाजारभाव उपलब्ध नाहीत',
                              en: 'No market rates available on $targetDate',
                            )
                          : AppLanguage().tr(
                              mr: 'या तारखेचे बाजारभाव उपलब्ध नाहीत',
                              en: 'No market rates available for this date',
                            )),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                ),
                const SizedBox(height: 4),
                Text(
                  AppLanguage().tr(
                    mr: 'ॲडमिनने दर अपडेट केल्यानंतर येथे दिसतील.',
                    en: 'Will be visible once Admin updates rates.',
                  ),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          );
        }

        final selected = comparisons[_selectedProductIndex.clamp(0, comparisons.length - 1)];

        // Build Donut slices based on market prices
        final slices = selected.markets.asMap().entries.map((entry) {
          final idx = entry.key;
          final m = entry.value;
          return (
            label: m.marketName,
            value: m.price,
            color: _chartColors[idx % _chartColors.length],
          );
        }).toList();

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title & Best Advantage Badge
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(selected.emoji, style: const TextStyle(fontSize: 16)),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            AppLanguage().tr(
                              mr: '${selected.cleanProductName} — दर तुलना',
                              en: '${selected.cleanProductName} — Rate Comparison',
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (selected.bestAdvantagePercent > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        AppLanguage().tr(
                          mr: '+${selected.bestAdvantagePercent.toStringAsFixed(1)}% जास्त भाव 📈',
                          en: '+${selected.bestAdvantagePercent.toStringAsFixed(1)}% Higher Rate 📈',
                        ),
                        style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                      ),
                    ),
                  ],
                ],
              ),

              const SizedBox(height: 10),

              // Date Selector Row (आज, काल, २ दिवस आधी, तारीख निवडा, सर्व)
              _buildDateSelectorRow(),

              const SizedBox(height: 10),

              // Product Selector Chips (Horizontal)
              SizedBox(
                height: 38,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: comparisons.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 6),
                  itemBuilder: (context, idx) {
                    final p = comparisons[idx];
                    final isSel = idx == _selectedProductIndex;
                    return InkWell(
                      onTap: () => setState(() => _selectedProductIndex = idx),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isSel ? const Color(0xFF16A34A) : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSel ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(p.emoji, style: const TextStyle(fontSize: 12)),
                            const SizedBox(width: 4),
                            Text(
                              p.cleanProductName,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: isSel ? FontWeight.bold : FontWeight.w600,
                                color: isSel ? Colors.white : const Color(0xFF334155),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 10),

              // Donut Chart + Market Percent breakdown
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 120,
                    height: 120,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CustomPaint(
                          size: const Size(120, 120),
                          painter: _DonutChartPainter(
                            slices: slices,
                            strokeWidth: 15.0,
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '+${selected.bestAdvantagePercent.toStringAsFixed(1)}%',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF16A34A),
                              ),
                            ),
                            Text(
                              AppLanguage().tr(mr: 'जास्त भाव', en: 'Higher Rate'),
                              style: const TextStyle(fontSize: 8.5, color: Color(0xFF6B7280), fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(width: 14),

                  // Markets with % comparison list
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: selected.markets.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final m = entry.value;
                        final color = _chartColors[idx % _chartColors.length];

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 5),
                          child: Row(
                            children: [
                              m.isGreenGroo
                                    ? const Text('🌿', style: TextStyle(fontSize: 9))
                                    : Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: color,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                              const SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  m.isGreenGroo
                                      ? AppLanguage().tr(mr: 'GreenGrocc खरेदी केंद्र', en: 'GreenGrocc Buying Centre')
                                      : m.marketName.replaceAll('APMC', '').trim(),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w600,
                                    color: m.isGreenGroo ? const Color(0xFF047857) : const Color(0xFF374151),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '₹${m.price.toStringAsFixed(0)}',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: m.isGreenGroo ? const Color(0xFF047857) : const Color(0xFF111827),
                                ),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                m.isGreenGroo
                                    ? (selected.greenGroccVsAvgPercent >= 0
                                        ? '(+${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}%)'
                                        : '(${selected.greenGroccVsAvgPercent.toStringAsFixed(1)}%)')
                                    : (m.percentHigher > 0
                                        ? '(+${m.percentHigher.toStringAsFixed(1)}%)'
                                        : AppLanguage().tr(mr: '(आधार)', en: '(Base)')),
                                style: TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.bold,
                                  color: m.isGreenGroo
                                      ? (selected.greenGroccVsAvgPercent >= 0
                                          ? const Color(0xFF16A34A)
                                          : const Color(0xFFDC2626))
                                      : (m.percentHigher > 0 ? const Color(0xFF16A34A) : const Color(0xFF9CA3AF)),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDateSelectorRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _dateChip(0, AppLanguage().tr(mr: 'आज', en: 'Today')),
          const SizedBox(width: 5),
          _dateChip(1, AppLanguage().tr(mr: 'काल', en: 'Yesterday')),
          const SizedBox(width: 5),
          _dateChip(2, AppLanguage().tr(mr: '२ दिवस आधी', en: '2 Days Ago')),
          const SizedBox(width: 5),
          // Custom Date Picker button
          _buildCustomDatePickerChip(),
          const SizedBox(width: 5),
          _dateChip(3, AppLanguage().tr(mr: 'सर्व दिवस', en: 'All Dates')),
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
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF16A34A) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSel ? const Color(0xFF16A34A) : const Color(0xFFCBD5E1),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.calendar_month_rounded,
              size: 11,
              color: isSel ? Colors.white : const Color(0xFF16A34A),
            ),
            const SizedBox(width: 4),
            Text(
              isSel && _customDate != null
                  ? '${_customDate!.day}/${_customDate!.month}/${_customDate!.year}'
                  : AppLanguage().tr(mr: '📅 तारीख निवडा', en: '📅 Select Date'),
              style: TextStyle(
                fontSize: 9,
                fontWeight: isSel ? FontWeight.bold : FontWeight.w600,
                color: isSel ? Colors.white : const Color(0xFF16A34A),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateChip(int index, String label) {
    final isSel = _selectedDateIndex == index;
    return InkWell(
      onTap: () => setState(() {
        _selectedDateIndex = index;
      }),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        decoration: BoxDecoration(
          color: isSel ? const Color(0xFF16A34A) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 9,
            fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
            color: isSel ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}

// ==========================================
// 🌟 SKELETON SHIMMER LOADER FOR FAST DASHBOARD
// ==========================================
/// Placeholder for a single dashboard section whose data has not loaded yet.
class _SectionSkeleton extends StatelessWidget {
  final double height;
  const _SectionSkeleton({required this.height});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: _SkeletonShimmer(
        child: Container(
          height: height,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _skeletonBox(width: 120, height: 12, borderRadius: 4),
              const SizedBox(height: 10),
              Expanded(child: _skeletonBox(width: double.infinity, borderRadius: 10)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SkeletonShimmer extends StatefulWidget {
  final Widget child;
  const _SkeletonShimmer({required this.child});

  @override
  State<_SkeletonShimmer> createState() => _SkeletonShimmerState();
}

class _SkeletonShimmerState extends State<_SkeletonShimmer> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final x = _controller.value * (bounds.width * 2) - bounds.width;
            return const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                Color(0xFFE2E8F0),
                Color(0xFFF8FAFC),
                Color(0xFFE2E8F0),
              ],
              stops: [0.0, 0.5, 1.0],
            ).createShader(Rect.fromLTWH(x, 0, bounds.width, bounds.height));
          },
          child: widget.child,
        );
      },
    );
  }
}

Widget _skeletonBox({
  double? width,
  double? height,
  double borderRadius = 8,
  EdgeInsetsGeometry? margin,
}) {
  return Container(
    width: width,
    height: height,
    margin: margin,
    decoration: BoxDecoration(
      color: const Color(0xFFE2E8F0),
      borderRadius: BorderRadius.circular(borderRadius),
    ),
  );
}

class _DashboardSkeletonLoader extends StatelessWidget {
  const _DashboardSkeletonLoader();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F8F5),
      body: SafeArea(
        child: _SkeletonShimmer(
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 30),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. TOP HEADER APPBAR SKELETON
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      _skeletonBox(width: 28, height: 28, borderRadius: 6),
                      const SizedBox(width: 12),
                      _skeletonBox(width: 38, height: 38, borderRadius: 12),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _skeletonBox(width: 140, height: 16, borderRadius: 4),
                            const SizedBox(height: 5),
                            _skeletonBox(width: 90, height: 11, borderRadius: 4),
                          ],
                        ),
                      ),
                      _skeletonBox(width: 34, height: 34, borderRadius: 17),
                    ],
                  ),
                ),

                const SizedBox(height: 8),

                // 2. HERO BANNER SKELETON
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    width: double.infinity,
                    height: 120,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _skeletonBox(width: 180, height: 20, borderRadius: 4),
                        const SizedBox(height: 10),
                        _skeletonBox(width: 230, height: 13, borderRadius: 4),
                        const SizedBox(height: 6),
                        _skeletonBox(width: 150, height: 13, borderRadius: 4),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // 3. 🏷️ MARKET PRICES CARD SKELETON
                _buildSectionHeaderSkeleton('Market Prices'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _skeletonBox(width: 150, height: 15, borderRadius: 4),
                            _skeletonBox(width: 80, height: 20, borderRadius: 10),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            _skeletonBox(width: 75, height: 24, borderRadius: 12),
                            const SizedBox(width: 6),
                            _skeletonBox(width: 75, height: 24, borderRadius: 12),
                            const SizedBox(width: 6),
                            _skeletonBox(width: 90, height: 24, borderRadius: 12),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            _skeletonBox(width: 105, height: 105, borderRadius: 52),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                children: [
                                  _skeletonBox(height: 22, borderRadius: 6),
                                  const SizedBox(height: 8),
                                  _skeletonBox(height: 22, borderRadius: 6),
                                  const SizedBox(height: 8),
                                  _skeletonBox(height: 22, borderRadius: 6),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // 4. 📊 FARM OVERVIEW 4 STAT CARDS SKELETON
                _buildSectionHeaderSkeleton('Farm Overview'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Expanded(child: _skeletonBox(height: 72, borderRadius: 12)),
                      const SizedBox(width: 8),
                      Expanded(child: _skeletonBox(height: 72, borderRadius: 12)),
                      const SizedBox(width: 8),
                      Expanded(child: _skeletonBox(height: 72, borderRadius: 12)),
                      const SizedBox(width: 8),
                      Expanded(child: _skeletonBox(height: 72, borderRadius: 12)),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // 5. 📦 ORDERS STATUS BAR CHART SKELETON
                _buildSectionHeaderSkeleton('Orders Status'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _skeletonBox(width: 160, height: 15, borderRadius: 4),
                            _skeletonBox(width: 50, height: 18, borderRadius: 9),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            _skeletonBox(width: 65, height: 22, borderRadius: 11),
                            const SizedBox(width: 5),
                            _skeletonBox(width: 65, height: 22, borderRadius: 11),
                            const SizedBox(width: 5),
                            _skeletonBox(width: 65, height: 22, borderRadius: 11),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            _skeletonBox(width: 75, height: 22, borderRadius: 11),
                            const SizedBox(width: 5),
                            _skeletonBox(width: 75, height: 22, borderRadius: 11),
                            const SizedBox(width: 5),
                            _skeletonBox(width: 75, height: 22, borderRadius: 11),
                          ],
                        ),
                        const SizedBox(height: 18),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: List.generate(6, (i) {
                            final h = [40.0, 65.0, 30.0, 50.0, 70.0, 25.0][i];
                            return Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _skeletonBox(width: 22, height: h, borderRadius: 4),
                                const SizedBox(height: 6),
                                _skeletonBox(width: 28, height: 10, borderRadius: 3),
                              ],
                            );
                          }),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // 6. 🚚 UPCOMING PICKUP SKELETON
                _buildSectionHeaderSkeleton('Upcoming Pickup'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            _skeletonBox(width: 36, height: 36, borderRadius: 10),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _skeletonBox(width: 120, height: 13, borderRadius: 4),
                                  const SizedBox(height: 4),
                                  _skeletonBox(width: 90, height: 11, borderRadius: 4),
                                ],
                              ),
                            ),
                            _skeletonBox(width: 60, height: 20, borderRadius: 6),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _skeletonBox(width: 70, height: 24, borderRadius: 4),
                            _skeletonBox(width: 70, height: 24, borderRadius: 4),
                            _skeletonBox(width: 70, height: 24, borderRadius: 4),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: _skeletonBox(height: 32, borderRadius: 8)),
                            const SizedBox(width: 8),
                            Expanded(child: _skeletonBox(height: 32, borderRadius: 8)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // 7. 💰 EARNINGS 4 METRICS SKELETON
                _buildSectionHeaderSkeleton('Earnings'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _skeletonBox(width: 70, height: 22, borderRadius: 11),
                          const SizedBox(width: 6),
                          _skeletonBox(width: 85, height: 22, borderRadius: 11),
                          const SizedBox(width: 6),
                          _skeletonBox(width: 80, height: 22, borderRadius: 11),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _skeletonBox(height: 68, borderRadius: 12)),
                          const SizedBox(width: 8),
                          Expanded(child: _skeletonBox(height: 68, borderRadius: 12)),
                          const SizedBox(width: 8),
                          Expanded(child: _skeletonBox(height: 68, borderRadius: 12)),
                          const SizedBox(width: 8),
                          Expanded(child: _skeletonBox(height: 68, borderRadius: 12)),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 18),

                // 8. 📈 EARNINGS TREND SKELETON
                _buildSectionHeaderSkeleton('Earnings Trend'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _skeletonBox(width: 140, height: 15, borderRadius: 4),
                            _skeletonBox(width: 70, height: 20, borderRadius: 10),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            _skeletonBox(width: 60, height: 20, borderRadius: 10),
                            const SizedBox(width: 5),
                            _skeletonBox(width: 60, height: 20, borderRadius: 10),
                            const SizedBox(width: 5),
                            _skeletonBox(width: 60, height: 20, borderRadius: 10),
                            const SizedBox(width: 5),
                            _skeletonBox(width: 60, height: 20, borderRadius: 10),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _skeletonBox(width: double.infinity, height: 120, borderRadius: 10),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // 9. ⚠️ PRODUCT REJECTION RATE SKELETON
                _buildSectionHeaderSkeleton('Product Rejection'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            _skeletonBox(width: 100, height: 100, borderRadius: 50),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                children: [
                                  _skeletonBox(height: 20, borderRadius: 6),
                                  const SizedBox(height: 8),
                                  _skeletonBox(height: 20, borderRadius: 6),
                                  const SizedBox(height: 8),
                                  _skeletonBox(height: 20, borderRadius: 6),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                // 10. 🏛️ GOVT SCHEMES SKELETON
                _buildSectionHeaderSkeleton('Govt Schemes'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Expanded(child: _skeletonBox(height: 110, borderRadius: 14)),
                      const SizedBox(width: 10),
                      Expanded(child: _skeletonBox(height: 110, borderRadius: 14)),
                    ],
                  ),
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Widget _buildSectionHeaderSkeleton(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              _skeletonBox(width: 18, height: 18, borderRadius: 4),
              const SizedBox(width: 8),
              _skeletonBox(width: 130, height: 13, borderRadius: 4),
            ],
          ),
          _skeletonBox(width: 60, height: 12, borderRadius: 4),
        ],
      ),
    );
  }
}



