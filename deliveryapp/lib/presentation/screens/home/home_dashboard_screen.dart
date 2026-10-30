import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/config/api_config.dart';
import '../../../core/constants/app_assets.dart';
import '../../../core/constants/app_spacing.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/announcement_service.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/notification_inbox_service.dart';
import '../../../data/services/order_service.dart';
import '../../../data/services/rider_live_service.dart';
import '../../../data/services/shift_service.dart';
import '../../../data/services/socket_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../shell/shell_navigation.dart';
import '../fulltime/fulltime_widgets.dart';
import '../../widgets/charts/weekly_bar_chart.dart';
import '../../widgets/dialogs/order_dispatch_dialog.dart';

const _kRupee = '\u20B9';

ImageProvider _avatarImage(DeliveryBoy? boy) {
  final raw = boy?.profileImageBytesOrUrl;
  if (raw is String && raw.isNotEmpty) {
    return NetworkImage(raw);
  }
  if (raw is Uint8List && raw.isNotEmpty) {
    return MemoryImage(raw);
  }
  return const AssetImage(AppAssets.deliveryScooter);
}

class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key});

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> with WidgetsBindingObserver {
  bool _isOnline = false;
  bool _updatingStatus = false;
  Timer? _heartbeat;
  Timer? _shiftEndOfflineTimer;
  StreamSubscription<bool>? _connectionSub;
  StreamSubscription<Map<String, dynamic>>? _deliveryUpdateSub;
  StreamSubscription<Map<String, dynamic>>? _offerSocketSub;
  StreamSubscription<Map<String, dynamic>>? _verifySocketSub;
  StreamSubscription<Map<String, dynamic>>? _verifyNotifSub;
  StreamSubscription<Map<String, dynamic>>? _forcedOfflineSub;
  VoidCallback? _offerRecoveryListener;
  bool _isShowingOffer = false;
  AreaManagerInfo? _areaManager;
  bool _loadingManager = false;
  String? _lastVerificationStatus;
  bool _showVerifiedBanner = false;
  List<GigInfo> _homeGigs = [];
  List<HrAnnouncement> _announcements = [];
  TodayProgressData _todayProgress = TodayProgressData.fallback;
  bool _loadingProgress = false;

  Future<void> _fetchTodayProgress() async {
    if (_loadingProgress) return;
    setState(() => _loadingProgress = true);
    try {
      final data = await RiderLiveService.instance.fetchTodayProgress();
      if (mounted) {
        setState(() {
          _todayProgress = data;
          _loadingProgress = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _todayProgress = TodayProgressData.fallback;
          _loadingProgress = false;
        });
      }
    }
  }

  Future<void> _loadGigsData() async {
    try {
      final gigs = await ShiftService.instance.fetchGigs();
      if (mounted) {
        setState(() {
          _homeGigs = gigs;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadAnnouncements() async {
    try {
      final items = await AnnouncementService.instance.fetchLive();
      if (mounted) setState(() => _announcements = items);
    } catch (_) {}
  }

  Future<void> _markAnnouncementRead(HrAnnouncement item) async {
    setState(() => _announcements = _announcements.where((a) => a.id != item.id).toList());
    await AnnouncementService.instance.markRead(item.id);
    final inbox = NotificationInboxService.instance;
    for (final n in inbox.items) {
      if (!n.isRead && n.data['announcementId']?.toString() == item.id) {
        inbox.markRead(n.id);
      }
    }
  }

  bool get _hasActiveTrip {
    final d = OrderService.instance.activeDelivery;
    if (d == null) return false;
    return ['assigned', 'pickup_verified', 'out_for_delivery'].contains(d.status);
  }

  /// Prefer trip lock over stale on_delivery / activeOrderId flags.
  bool get _hasActiveOrder => _hasActiveTrip;

  List<ActiveDeliveryData> get _activePreOrders =>
      OrderService.instance.activeDeliveries.where((d) => d.isPreOrder).toList();

  /// Every active stop is a pre-order — those are worked from the Pre-order deliveries list.
  bool get _onlyPreOrders {
    final all = OrderService.instance.activeDeliveries;
    return all.isNotEmpty && all.every((d) => d.isPreOrder);
  }

  void _announcePreOrdersAssigned(Map<String, dynamic> event) {
    if (event['event'] != 'active_delivery_updated' || event['reason'] != 'preorders_assigned') return;
    final ids = event['orderIds'];
    final count = ids is List ? ids.length : 0;
    if (count == 0 || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 8),
        persist: false,
        content: Text(AppLocalizations.of(context).managerAssignedPreOrders(count)),
        action: SnackBarAction(
          label: AppLocalizations.of(context).view,
          onPressed: () => Navigator.pushNamed(context, AppRoutes.preOrderDeliveries),
        ),
      ),
    );
  }

  bool get _verificationPending {
    final boy = AuthService.instance.deliveryBoy;
    if (boy == null) return false;
    return boy.onboardingComplete && boy.isVerificationPending;
  }

  String get _partnerName {
    final boy = AuthService.instance.deliveryBoy;
    final name = boy?.name.trim() ?? '';
    if (name.isNotEmpty) return name;
    return AppLocalizations.of(context).partnerName;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _lastVerificationStatus =
        AuthService.instance.deliveryBoy?.verificationStatus;
    _isOnline = AuthService.instance.deliveryBoy?.isOnline ?? false;
    if (_isOnline) {
      _startHeartbeat();
    }
    AuthService.instance.boyNotifier.addListener(_onBoyChanged);
    _listenForOffers();
    _listenForVerification();
    _listenForForcedOffline();
    _listenForOfferRecovery();
    _listenForServerChanges();
    _bootstrapHome();
  }

  void _onBoyChanged() {
    if (!mounted) return;
    setState(() {});
  }

  /// No polling: offers, verification and trip changes arrive over the socket /
  /// FCM. We only re-sync on reconnect or when the app comes back to the foreground,
  /// to pick up anything sent while the connection was down.
  void _listenForServerChanges() {
    _connectionSub?.cancel();
    _connectionSub = SocketService.instance.onConnectionChanged.listen((connected) {
      if (connected) _catchUpWithServer();
    });
    _deliveryUpdateSub?.cancel();
    _deliveryUpdateSub = SocketService.instance.onActiveDeliveryUpdated.listen((event) async {
      _announcePreOrdersAssigned(event);
      await OrderService.instance.fetchActiveDelivery();
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _catchUpWithServer();
  }

  Future<void> _catchUpWithServer() async {
    if (!mounted) return;
    if (_verificationPending || _lastVerificationStatus != 'approved') {
      await _refreshVerificationInfo();
    }
    await OrderService.instance.fetchActiveDelivery();
    if (!mounted) return;
    setState(() {});
    _checkOrderOffers();
  }

  /// One coordinated load: single /me + parallel page data (no stacked waits).
  Future<void> _bootstrapHome() async {
    final meFuture = AuthService.instance.fetchMe();

    await Future.wait<void>([
      meFuture.then((boy) {
        if (!mounted) return;
        _applyVerificationFromBoy(boy);
        setState(() {
          _isOnline = boy?.isOnline ?? _isOnline;
        });
        if (_hasActiveOrder && _isOnline) {
          _startHeartbeat();
        }
      }),
      OrderService.instance.fetchActiveDelivery().then((_) {
        if (mounted) setState(() {});
      }),
      RiderLiveService.instance.refreshLoginHours().then((_) async {
        await RiderLiveService.instance.refreshPeakHours('store_1');
        if (mounted) setState(() {});
      }),
      _loadGigsData(),
      _fetchTodayProgress(),
      _loadAnnouncements(),
    ]);

    if (!mounted) return;
    // After first /me settles, check slot alerts (shares fetchMe in-flight when possible).
    _showSlotCancellationAlerts();
    // Recover pending Accept/Decline if offer arrived while app was closed.
    if (_isOnline) {
      _checkOrderOffers();
    }
  }

  void _applyVerificationFromBoy(DeliveryBoy? boy) {
    final status = boy?.verificationStatus ?? 'pending';
    if (_lastVerificationStatus == 'pending' && status == 'approved') {
      setState(() => _showVerifiedBanner = true);
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _showVerifiedBanner = false);
      });
    }
    _lastVerificationStatus = status;
    if (boy != null && (boy.isVerificationPending || status == 'rejected')) {
      _fetchAreaManagerDetails();
    }
  }

  void _listenForOffers() {
    _offerSocketSub?.cancel();
    _offerSocketSub = SocketService.instance.onOrderOfferReceived.listen((data) {
      if (!_isOnline || _isShowingOffer || !mounted) return;
      // Only skip if rider already has a real active trip
      if (_hasActiveTrip) return;
      try {
        final offer = OrderOffer.fromJson(data);
        if (offer.orderId.isEmpty) return;
        _showOfferDialog(offer);
      } catch (_) {}
    });
  }

  void _listenForForcedOffline() {
    _forcedOfflineSub?.cancel();
    _forcedOfflineSub =
        SocketService.instance.onForcedOffline.listen((data) async {
      if (!mounted) return;
      final msg = data['message']?.toString().trim();
      setState(() => _isOnline = false);
      _stopHeartbeat();
      _shiftEndOfflineTimer?.cancel();
      await AuthService.instance.fetchMe();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            (msg != null && msg.isNotEmpty)
                ? msg
                : AppLocalizations.of(context).shiftEndedNowOffline,
          ),
          backgroundColor: AppColors.warning,
          duration: const Duration(seconds: 5),
        ),
      );
    });
  }

  void _listenForOfferRecovery() {
    _offerRecoveryListener?.call();
    void handler() {
      final payload = ShellNavigation.instance.pendingOfferRecovery.value;
      if (payload == null) return;
      ShellNavigation.instance.pendingOfferRecovery.value = null;
      // Delay so shell/home finish mounting after cold start.
      Future.delayed(const Duration(milliseconds: 600), () {
        if (!mounted) return;
        final orderId = (payload['orderId'] ?? '').toString();
        _recoverOfferFromNotification(orderId: orderId);
      });
    }

    ShellNavigation.instance.pendingOfferRecovery.addListener(handler);
    _offerRecoveryListener = () {
      ShellNavigation.instance.pendingOfferRecovery.removeListener(handler);
    };
    // Consume any tap that arrived before home mounted.
    if (ShellNavigation.instance.pendingOfferRecovery.value != null) {
      handler();
    }
  }

  /// Notification opened app (closed/background) → fetch pending offer → Accept/Decline.
  Future<void> _recoverOfferFromNotification({String? orderId}) async {
    if (!mounted || _isShowingOffer) return;
    try {
      final result = await OrderService.instance.checkForOfferDetailed(
        orderId: orderId,
      );
      if (!mounted) return;
      if (result.offer != null) {
        await _showOfferDialog(result.offer!);
        return;
      }
      if (result.reason == 'already_accepted') {
        await OrderService.instance.fetchActiveDelivery();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(AppLocalizations.of(context).orderAlreadyAccepted),
              backgroundColor: const Color(0xFF059669),
            ),
          );
          Navigator.pushNamed(context, AppRoutes.activeDelivery);
        }
        return;
      }
      if (result.reason == 'expired_or_reassigned' ||
          result.reason == 'cancelled' ||
          result.reason == 'not_found') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocalizations.of(context).assignmentNoLongerAvailable,
            ),
            backgroundColor: const Color(0xFFB45309),
          ),
        );
      }
    } catch (_) {}
  }

  /// Manager approve/reject → socket + push. Instant verified UI (no page leave).
  void _listenForVerification() {
    final boyId = AuthService.instance.deliveryBoy?.id;
    if (boyId != null && boyId.isNotEmpty) {
      SocketService.instance.connect(boyId);
    }

    _verifySocketSub?.cancel();
    _verifySocketSub =
        SocketService.instance.onDocumentReviewUpdate.listen((data) async {
      await _handleVerificationEvent(data);
    });

    // Also handle VERIFICATION_COMPLETED inbox/push socket
    _verifyNotifSub?.cancel();
    _verifyNotifSub =
        SocketService.instance.onRiderNotification.listen((data) async {
      final type = data['type']?.toString() ?? '';
      if (type != 'VERIFICATION_COMPLETED') return;
      await AuthService.instance.applyVerificationStatus('approved');
      await AuthService.instance.fetchMe();
      if (!mounted) return;
      _applyVerificationFromBoy(AuthService.instance.deliveryBoy);
      setState(() {});
    });
  }

  Future<void> _handleVerificationEvent(Map<String, dynamic> data) async {
    var status = data['verificationStatus']?.toString() ?? '';
    if (status == 'verified') status = 'approved';
    if (status != 'approved' && status != 'rejected') {
      final boy = await AuthService.instance.fetchMe();
      if (!mounted) return;
      _applyVerificationFromBoy(boy);
      setState(() {});
      return;
    }

    await AuthService.instance.applyVerificationStatus(status);
    await AuthService.instance.fetchMe();
    if (!mounted) return;
    _applyVerificationFromBoy(AuthService.instance.deliveryBoy);
    setState(() {});
  }

  Future<void> _checkOrderOffers() async {
    if (!_isOnline || _hasActiveTrip || _isShowingOffer) return;
    try {
      final offer = await OrderService.instance.checkForOffer();
      if (offer != null && mounted && !_isShowingOffer && !_hasActiveTrip) {
        await _showOfferDialog(offer);
      }
    } catch (_) {
      _isShowingOffer = false;
    }
  }

  Future<void> _showOfferDialog(OrderOffer offer) async {
    if (_isShowingOffer || !mounted) return;
    _isShowingOffer = true;
    try {
      await OrderDispatchDialog.show(
        context,
        offer: offer,
        onAccept: () async {
          final ok = await OrderService.instance.acceptOffer(offer.orderId);
          if (ok && mounted) {
            await AuthService.instance.fetchMe();
            if (mounted) {
              setState(() {
                _isOnline = true;
              });
              Navigator.pushNamed(context, AppRoutes.activeDelivery);
            }
          }
        },
        onDecline: () async {
          await OrderService.instance.declineOffer(offer.orderId);
        },
      );
    } finally {
      _isShowingOffer = false;
    }
  }

  Future<void> _refreshVerificationInfo() async {
    final boy = await AuthService.instance.fetchMe();
    if (!mounted) return;
    _applyVerificationFromBoy(boy);
    setState(() {});
  }

  Future<void> _fetchAreaManagerDetails() async {
    if (_loadingManager) return;
    setState(() => _loadingManager = true);
    final mgr =
        _areaManager ?? await AuthService.instance.fetchAreaManager();
    if (mounted) {
      setState(() {
        _areaManager = mgr;
        _loadingManager = false;
      });
    }
  }

  Future<void> _showSlotCancellationAlerts() async {
    final msgs = await AuthService.instance.consumeSlotCancellationAlerts();
    if (!mounted || msgs.isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msgs.join('\n')),
        duration: const Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    AuthService.instance.boyNotifier.removeListener(_onBoyChanged);
    _heartbeat?.cancel();
    _shiftEndOfflineTimer?.cancel();
    _connectionSub?.cancel();
    _deliveryUpdateSub?.cancel();
    _offerSocketSub?.cancel();
    _verifySocketSub?.cancel();
    _verifyNotifSub?.cancel();
    _forcedOfflineSub?.cancel();
    _offerRecoveryListener?.call();
    _offerRecoveryListener = null;
    super.dispose();
  }

  void _startHeartbeat() {
    _heartbeat?.cancel();
    _heartbeat = Timer.periodic(const Duration(seconds: 30), (_) {
      AuthService.instance.sendHeartbeat();
    });
  }

  void _stopHeartbeat() {
    _heartbeat?.cancel();
    _heartbeat = null;
  }

  /// Client backup: 5 minutes after shift/gig end → go offline locally + API.
  void _scheduleShiftEndAutoOffline(String? endTime) {
    _shiftEndOfflineTimer?.cancel();
    if (endTime == null || endTime.trim().isEmpty) return;

    final endMin = _parseTimeToMinutes(endTime);
    if (endMin == null) return;

    final now = DateTime.now();
    final nowMin = now.hour * 60 + now.minute;
    var minutesUntilForce = (endMin + 5) - nowMin;
    if (minutesUntilForce <= 0) {
      // End already passed — force soon (server is source of truth).
      minutesUntilForce = 1;
    }

    _shiftEndOfflineTimer = Timer(Duration(minutes: minutesUntilForce), () async {
      if (!mounted || !_isOnline || _hasActiveOrder) return;
      final ok = await ShiftService.instance.goOffline();
      if (!mounted) return;
      if (ok) {
        setState(() => _isOnline = false);
        _stopHeartbeat();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).shiftEndedGraceOffline),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    });
  }

  int? _parseTimeToMinutes(String time) {
    final t = time.trim();
    final ampm = RegExp(r'^(\d{1,2}):(\d{2})\s*(AM|PM)$', caseSensitive: false);
    final m1 = ampm.firstMatch(t);
    if (m1 != null) {
      var h = int.parse(m1.group(1)!);
      final min = int.parse(m1.group(2)!);
      final ap = m1.group(3)!.toUpperCase();
      if (ap == 'PM' && h != 12) h += 12;
      if (ap == 'AM' && h == 12) h = 0;
      return h * 60 + min;
    }
    final m2 = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(t);
    if (m2 != null) {
      return int.parse(m2.group(1)!) * 60 + int.parse(m2.group(2)!);
    }
    return null;
  }

  Future<void> _onStatusToggle({bool fromGig = false}) async {
    if (_updatingStatus) return;

    final targetOnline = !_isOnline;

    if (targetOnline) {
      final isVerified =
          AuthService.instance.deliveryBoy?.isVerified ?? false;
      if (!isVerified) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).verificationRequiredToGoOnline),
            backgroundColor: AppColors.warning,
          ),
        );
        return;
      }
    }

    setState(() => _updatingStatus = true);

    try {
      if (targetOnline) {
        final pos = await LocationService.instance.getCurrentLocation();
        final lat = pos?.latitude ?? 18.559;
        final lng = pos?.longitude ?? 73.7868;

        final res = await ShiftService.instance.goOnlineWithLocation(lat, lng);

        if (!mounted) return;

        if (res.success) {
          setState(() {
            _isOnline = true;
          });
          final boyId = AuthService.instance.deliveryBoy?.id;
          if (boyId != null && boyId.isNotEmpty) {
            SocketService.instance.connect(boyId);
          }
          _startHeartbeat();
          _checkOrderOffers();
          _scheduleShiftEndAutoOffline(res.endTime);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(res.message),
              backgroundColor: AppColors.success,
            ),
          );
        } else {
          setState(() {
            _isOnline = false;
          });

          if (res.code == 'SHIFT_REQUIRED' || res.code == 'NO_SHIFT_BOOKED') {
            _showShiftRequiredDialog(AppLocalizations.of(context).noSlotAssignedMessage);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(res.message),
                backgroundColor: AppColors.error,
                duration: const Duration(seconds: 4),
              ),
            );
          }
        }
      } else {
        final ok = await ShiftService.instance.goOffline();
        if (!mounted) return;

        if (ok) {
          setState(() {
            _isOnline = false;
          });
          _stopHeartbeat();
          _shiftEndOfflineTimer?.cancel();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(AppLocalizations.of(context).youAreNowOffline),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(AppLocalizations.of(context).failedToUpdateStatus),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).somethingWentWrong),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _updatingStatus = false);
      }
    }
  }

  void _showShiftRequiredDialog(String message) {
    final l10n = AppLocalizations.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.schedule_rounded, color: AppColors.primary),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                l10n.noSlotAssignedTitle,
                style: GoogleFonts.inter(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: Text(
          message,
          style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(l10n.cancel),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              ShellNavigation.instance.goToTab(1);
            },
            child: Text(l10n.viewMySlots),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      children: [
        // FIXED / STICKY TOP HEADER
        Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            MediaQuery.of(context).padding.top + AppSpacing.xs,
            AppSpacing.md,
            AppSpacing.xs,
          ),
          child: _TopHeaderSection(
            name: _partnerName,
            isOnline: _isOnline,
            isVerified: AuthService.instance.deliveryBoy?.isVerified ?? false,
            deliveryBoy: AuthService.instance.deliveryBoy,
            onProfileTap: () async {
              await Navigator.pushNamed(context, AppRoutes.profile);
              if (mounted) setState(() {});
            },
            onDrawerTap: () => Scaffold.of(context).openDrawer(),
          ),
        ),

        // SCROLLABLE CONTENT BETWEEN HEADER AND BOTTOM BAR
        Expanded(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.xs,
              AppSpacing.md,
              AppSpacing.xl * 2,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // VERIFICATION NOTICE IF PENDING / REJECTED
                if (_showVerifiedBanner) ...[
                  _VerifiedBanner(text: l10n.verificationApprovedToast),
                  const SizedBox(height: 14),
                ],
                if (_verificationPending ||
                    AuthService.instance.deliveryBoy?.verificationStatus == 'rejected') ...[
                  _VerificationNoticeCard(
                    pending: _verificationPending,
                    rejected: AuthService.instance.deliveryBoy?.verificationStatus == 'rejected',
                    manager: _areaManager,
                    loading: _loadingManager,
                  ),
                  const SizedBox(height: 14),
                ],
                if (_announcements.isNotEmpty) ...[
                  ..._announcements.take(3).map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: _HrAnnouncementCard(
                        title: item.title,
                        body: item.body,
                        kind: item.kind,
                        status: item.status,
                        date: item.date,
                        onRead: () => _markAnnouncementRead(item),
                      ),
                    ),
                  ),
                ],

                // CASH ON DELIVERY WARNING BANNER
                if ((AuthService.instance.deliveryBoy?.pendingCashAmount ?? 0) > 0) ...[
                  _CodCashWarningCard(
                    amount: AuthService.instance.deliveryBoy!.pendingCashAmount,
                  ),
                  const SizedBox(height: 14),
                ],

                if (_activePreOrders.isNotEmpty) ...[
                  _PreOrderHomeCard(
                    count: _activePreOrders.length,
                    toScan: _activePreOrders.where((d) => !d.customerAddressUnlocked).length,
                    onOpen: () => Navigator.pushNamed(context, AppRoutes.preOrderDeliveries),
                  ),
                  const SizedBox(height: 14),
                ],

                // ACTIVE ORDER CARD IF ON DELIVERY
                if (_hasActiveOrder && !_onlyPreOrders) ...[
                  _ActiveDeliveryCard(
                    onOpen: () => Navigator.pushNamed(context, AppRoutes.activeDelivery),
                    continueLabel: l10n.continueDelivery,
                  ),
                  const SizedBox(height: 14),
                ],

                if (AuthService.instance.deliveryBoy?.isFullTime ?? false) ...[
                  const FullTimeHomeCard(),
                  const SizedBox(height: 2),
                ],

                // 3. GO ONLINE DIRECT BANNER CARD
                _GoOnlineBannerCard(
                  isOnline: _isOnline,
                  updatingStatus: _updatingStatus,
                  onStatusToggle: () => _onStatusToggle(),
                ),
                const SizedBox(height: 18),

                // 4. TODAY'S PROGRESS SECTION
                _TodaysProgressSectionCard(
                  data: _todayProgress,
                  isLoading: _loadingProgress,
                  onViewAll: () => Navigator.pushNamed(context, AppRoutes.deliveryHistory),
                ),
                const SizedBox(height: 18),

                // FEATURED INCENTIVE / GIG BANNER CARD (Only shown if backend has registered gigs for the store)
                if (_homeGigs.isNotEmpty) ...[
                  _FeaturedGigBannerCard(
                    gig: _homeGigs.first,
                    totalGigsCount: _homeGigs.length,
                    isOnline: _isOnline,
                    onViewGigs: () => Navigator.pushNamed(context, AppRoutes.gigs),
                    onGoOnline: () {
                      if (!_isOnline) _onStatusToggle(fromGig: true);
                    },
                  ),
                  const SizedBox(height: 14),
                  _LiveGigIncentiveProgressCard(
                    gig: _homeGigs.first,
                  ),
                  const SizedBox(height: 14),
                ],

                // 6. PERFORMANCE SUMMARY
                _HomePerformanceCard(
                  onOpen: () => Navigator.pushNamed(context, AppRoutes.performance),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// 1. Top Header with Menu Button, Name, Verified Tick, Offline/Online status & Avatar
class _TopHeaderSection extends StatelessWidget {
  const _TopHeaderSection({
    required this.name,
    required this.isOnline,
    required this.isVerified,
    required this.onProfileTap,
    required this.onDrawerTap,
    this.deliveryBoy,
  });

  final String name;
  final bool isOnline;
  final bool isVerified;
  final VoidCallback onProfileTap;
  final VoidCallback onDrawerTap;
  final DeliveryBoy? deliveryBoy;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final displayName = name.isNotEmpty ? name : 'Driver1';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // ROW 1: HAMBURGER MENU + GREENGROO DELIVERY PARTNER (LEFT)  |  PROFILE AVATAR (RIGHT)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Drawer Hamburger Menu Icon
                InkWell(
                  onTap: onDrawerTap,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.all(4.0),
                    child: Icon(
                      Icons.menu_rounded,
                      size: 28,
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                    ),
                  ),
                ),
                const SizedBox(width: 10),

                // GreenGroo Delivery Partner Brand on the left
                Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'GreenGroo',
                          style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: isDark ? const Color(0xFF4ADE80) : const Color(0xFF0F5132),
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(
                          Icons.eco_rounded,
                          color: Color(0xFF16A34A),
                          size: 20,
                        ),
                      ],
                    ),
                    Text(
                      AppLocalizations.of(context).deliveryPartner,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isDark ? const Color(0xFF22C55E) : const Color(0xFF16A34A),
                      ),
                    ),
                  ],
                ),
              ],
            ),

            // Profile avatar
            GestureDetector(
              onTap: onProfileTap,
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF16A34A), width: 1.5),
                  image: DecorationImage(
                    image: _avatarImage(deliveryBoy),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // ROW 2: ONLY DRIVER NAME (NO "Hello, ") + VERIFIED BADGE ON LEFT & STATUS PILL ON RIGHT (NO BELL)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayName,
                  style: GoogleFonts.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
                  ),
                ),
                if (isVerified) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 18,
                    height: 18,
                    decoration: const BoxDecoration(
                      color: Color(0xFF059669),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.check,
                        size: 12,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isOnline
                    ? (isDark ? const Color(0xFF064E3B) : const Color(0xFFDCFCE7))
                    : (isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9)),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: isOnline
                          ? const Color(0xFF16A34A)
                          : const Color(0xFF94A3B8),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isOnline ? AppLocalizations.of(context).online : AppLocalizations.of(context).offline,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isOnline
                          ? (isDark ? const Color(0xFF4ADE80) : const Color(0xFF15803D))
                          : (isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// 2. Featured Incentive Banner Card (Lunch Incentive / Gig)
class _FeaturedGigBannerCard extends StatelessWidget {
  const _FeaturedGigBannerCard({
    required this.gig,
    required this.totalGigsCount,
    required this.isOnline,
    required this.onViewGigs,
    required this.onGoOnline,
  });

  final GigInfo? gig;
  final int totalGigsCount;
  final bool isOnline;
  final VoidCallback onViewGigs;
  final VoidCallback onGoOnline;

  @override
  Widget build(BuildContext context) {
    final rawTitle = gig?.title ?? AppLocalizations.of(context).lunchIncentive;
    final title = rawTitle.toLowerCase().contains('lunch')
        ? AppLocalizations.of(context).lunchIncentive
        : rawTitle.toLowerCase().contains('dinner')
            ? AppLocalizations.of(context).dinnerIncentive
            : rawTitle;
    final timeStr = gig != null
        ? '${gig!.startTime} - ${gig!.endTime}'
        : '05:00 PM - 07:00 PM';
    final bonus = gig?.bonusAmount ?? 180;
    final desc = (gig?.description.isNotEmpty == true)
        ? gig!.description
        : AppLocalizations.of(context).specialGigDesc;
    final bool hasMultipleGigs = totalGigsCount > 1;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: Color(0xFF047857),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(Icons.star_rounded, color: Color(0xFFFACC15), size: 26),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          Icons.access_time_outlined,
                          size: 16,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          timeStr,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      AppLocalizations.of(context).earnUpToExtra('$_kRupee$bonus'),
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF047857),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      desc,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: BorderSide(
                      color: hasMultipleGigs ? const Color(0xFF059669) : const Color(0xFFE2E8F0),
                      width: 1.5,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: hasMultipleGigs ? onViewGigs : null,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          AppLocalizations.of(context).viewAllGigs,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: hasMultipleGigs ? const Color(0xFF059669) : const Color(0xFF94A3B8),
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 18,
                          color: hasMultipleGigs ? const Color(0xFF059669) : const Color(0xFF94A3B8),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF047857),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: isOnline ? null : onGoOnline,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          isOnline
                              ? AppLocalizations.of(context).youreOnline
                              : AppLocalizations.of(context).goOnline,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.chevron_right_rounded, size: 18, color: Colors.white),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 3. Go Online Direct Banner Card
class _GoOnlineBannerCard extends StatelessWidget {
  const _GoOnlineBannerCard({
    required this.isOnline,
    required this.updatingStatus,
    required this.onStatusToggle,
  });

  final bool isOnline;
  final bool updatingStatus;
  final VoidCallback onStatusToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFF0F5A32),
            Color(0xFF084826),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F5A32).withValues(alpha: 0.2),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          // Lightning bolt circular badge
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: Color(0xFF22C55E),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Icon(
                Icons.bolt_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 10),

          // Title & Subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isOnline ? AppLocalizations.of(context).youAreOnline : AppLocalizations.of(context).readyToDeliver,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  isOnline
                      ? AppLocalizations.of(context).receivingNearbyRequests
                      : AppLocalizations.of(context).goOnlineToReceiveRequests,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: Colors.white.withValues(alpha: 0.88),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Go Online / Go Offline White Pill Button
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: updatingStatus ? null : onStatusToggle,
              borderRadius: BorderRadius.circular(30),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: updatingStatus
                    ? SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.8,
                          color: isOnline
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF0F5A32),
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.power_settings_new_rounded,
                            size: 15,
                            color: isOnline
                                ? const Color(0xFFDC2626)
                                : const Color(0xFF0F5A32),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            isOnline ? AppLocalizations.of(context).goOffline : AppLocalizations.of(context).goOnline,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: isOnline
                                  ? const Color(0xFFDC2626)
                                  : const Color(0xFF0F5A32),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 4. Today's Progress Section Card (5 distinct Cards in 2 Rows matching Image 1)
class _TodaysProgressSectionCard extends StatelessWidget {
  const _TodaysProgressSectionCard({
    required this.data,
    required this.isLoading,
    required this.onViewAll,
  });

  final TodayProgressData data;
  final bool isLoading;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);
    final earningsStr = '₹${data.todayEarnings}';
    final tripsStr = '${data.completedTrips}';
    final onlineStr = data.onlineTime;
    final shiftsStr = '${data.bookedShifts}';
    final completedStr = '${data.completedShifts}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              l10n.todaysProgressTitle,
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
              ),
            ),
            InkWell(
              onTap: onViewAll,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    AppLocalizations.of(context).viewAll,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF047857),
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: Color(0xFF047857),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (isLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Color(0xFF047857),
                ),
              ),
            ),
          )
        else ...[
          // ROW 1: 3 CARDS
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  iconWidget: const Text(
                    '₹',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF047857),
                    ),
                  ),
                  value: earningsStr,
                  label: l10n.todaysEarningsLabel,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  iconWidget: const Icon(
                    Icons.inventory_2_outlined,
                    size: 20,
                    color: Color(0xFF047857),
                  ),
                  value: tripsStr,
                  label: l10n.tripsCompletedLabel,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  iconWidget: const Icon(
                    Icons.schedule_rounded,
                    size: 20,
                    color: Color(0xFF047857),
                  ),
                  value: onlineStr,
                  label: l10n.onlineTime,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // ROW 2: 2 CARDS
          Row(
            children: [
              Expanded(
                child: _HorizontalMetricCard(
                  icon: Icons.calendar_today_outlined,
                  value: shiftsStr,
                  label: l10n.shiftsBookedLabel,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HorizontalMetricCard(
                  icon: Icons.check_circle_outline_rounded,
                  value: completedStr,
                  label: l10n.completedShiftsLabel,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.iconWidget,
    required this.value,
    required this.label,
  });

  final Widget iconWidget;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? const Color(0xFF334155) : const Color(0xFFE5E7EB),
          width: 1.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF064E3B) : const Color(0xFFDCFCE7),
              shape: BoxShape.circle,
            ),
            child: Center(child: iconWidget),
          ),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
              ),
              maxLines: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF6B7280),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _HorizontalMetricCard extends StatelessWidget {
  const _HorizontalMetricCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? const Color(0xFF334155) : const Color(0xFFE5E7EB),
          width: 1.2,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF064E3B) : const Color(0xFFDCFCE7),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Icon(
                icon,
                size: 20,
                color: isDark ? const Color(0xFF4ADE80) : const Color(0xFF047857),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF6B7280),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 5. Incentive Progress & Bonus Levels Card
class _LiveGigIncentiveProgressCard extends StatelessWidget {
  const _LiveGigIncentiveProgressCard({required this.gig});

  final GigInfo? gig;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final title = gig?.title ?? l10n.lunchIncentive;
    final tiers = gig?.tiers ?? [];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.currentEarningsLabel,
                              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${_kRupee}0 / ${_kRupee}200',
                              style: GoogleFonts.inter(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 24),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.currentBonusLabel,
                              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textMuted),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '+${_kRupee}18',
                              style: GoogleFonts.inter(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF059669),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  color: ThemeController.instance.isDark ? const Color(0xFF064E3B) : const Color(0xFFF0FDF4),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text('🎯🪙', style: TextStyle(fontSize: 34)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: 0.05,
              minHeight: 6,
              backgroundColor: AppColors.cardSubBorder,
              color: const Color(0xFF059669),
            ),
          ),
          const SizedBox(height: 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  l10n.completeMoreOrdersForBonus(12, '${_kRupee}18'),
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                l10n.ordersProgress(0, 12),
                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 14),

          Text(
            AppLocalizations.of(context).incentiveSlabsBonusLevels,
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 10),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: tiers.isNotEmpty
                  ? tiers.asMap().entries.map((e) {
                      final isFirst = e.key == 0;
                      return _SlabCard(
                        amount: '$_kRupee${e.value.minTarget}',
                        bonus: '+$_kRupee${e.value.bonusAmount}',
                        isSelected: isFirst,
                        isLocked: !isFirst,
                      );
                    }).toList()
                  : const [
                      _SlabCard(amount: '₹200', bonus: '+₹18', isSelected: true, isLocked: false),
                      _SlabCard(amount: '₹400', bonus: '+₹60', isSelected: false, isLocked: true),
                      _SlabCard(amount: '₹600', bonus: '+₹100', isSelected: false, isLocked: true),
                      _SlabCard(amount: '₹800', bonus: '+₹140', isSelected: false, isLocked: true),
                      _SlabCard(amount: '₹1000', bonus: '+₹180', isSelected: false, isLocked: true),
                    ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SlabCard extends StatelessWidget {
  const _SlabCard({
    required this.amount,
    required this.bonus,
    required this.isSelected,
    this.isLocked = true,
  });

  final String amount;
  final String bonus;
  final bool isSelected;
  final bool isLocked;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isSelected
            ? (ThemeController.instance.isDark ? const Color(0xFF064E3B) : const Color(0xFFF0FDF4))
            : (isLocked ? AppColors.cardSubBg : AppColors.cardBackground),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelected
              ? (ThemeController.instance.isDark ? const Color(0xFF10B981) : const Color(0xFF059669))
              : AppColors.cardSubBorder,
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isLocked) ...[
                const Icon(
                  Icons.lock_rounded,
                  size: 11,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(width: 3),
              ],
              Text(
                amount,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isLocked ? AppColors.textMuted : AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            bonus,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isLocked ? const Color(0xFF059669).withValues(alpha: 0.7) : const Color(0xFF059669),
            ),
          ),
        ],
      ),
    );
  }
}

/// 6. Performance — Shows graph if data exists, or empty state matching Image 1 if no data.
class _HomePerformanceCard extends StatefulWidget {
  const _HomePerformanceCard({required this.onOpen});

  final VoidCallback onOpen;

  @override
  State<_HomePerformanceCard> createState() => _HomePerformanceCardState();
}

class _HomePerformanceCardState extends State<_HomePerformanceCard> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await apiGet(
        ApiConfig.performance,
        headers: AuthService.instance.authHeaders,
      );
      if (res.statusCode != 200) throw Exception('Failed');
      final body = jsonDecode(res.body);
      if (!mounted) return;
      setState(() {
        _data = body is Map<String, dynamic> ? body : null;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double _pct(String key) => (_data?[key] as num?)?.toDouble() ?? 0;

  @override
  Widget build(BuildContext context) {
    final rating = _data?['customerRating'] as Map<String, dynamic>?;
    final avg = (rating?['average'] as num?)?.toDouble() ?? 0;
    final ratingCount = (rating?['count'] as num?)?.toInt() ?? 0;
    final acceptance = _pct('acceptanceRate');
    final onTime = _pct('onTimeDeliveryRate');
    final decline = _pct('declineRate');
    final ratingPct = (avg / 5 * 100).clamp(0.0, 100.0);

    final counts = _data?['counts'] as Map<String, dynamic>?;
    final offered = (counts?['offered'] as num?)?.toInt() ?? 0;
    final delivered = (counts?['delivered'] as num?)?.toInt() ?? 0;

    final hasData = offered > 0 || delivered > 0 || ratingCount > 0 || avg > 0 || acceptance > 0 || onTime > 0;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.trending_up_rounded,
                  color: Color(0xFF047857),
                  size: 24,
                ),
                const SizedBox(width: 8),
                Text(
                  l10n.performance,
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
            InkWell(
              onTap: widget.onOpen,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    AppLocalizations.of(context).viewAll,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF047857),
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: Color(0xFF047857),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Material(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: widget.onOpen,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark ? const Color(0xFF334155) : const Color(0xFFE5E7EB),
                  width: 1.2,
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      height: 160,
                      child: Center(
                        child: SizedBox(
                          width: 26,
                          height: 26,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Color(0xFF047857),
                          ),
                        ),
                      ),
                    )
                  : hasData
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Quick stats row above chart
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                _StatPill(
                                  label: l10n.ratingLabel,
                                  value: avg > 0 ? '${avg.toStringAsFixed(1)} ★' : '—',
                                  color: const Color(0xFF047857),
                                ),
                                _StatPill(
                                  label: l10n.acceptanceLabel,
                                  value: '${acceptance.toInt()}%',
                                  color: const Color(0xFF10B981),
                                ),
                                _StatPill(
                                  label: l10n.onTimeLabel,
                                  value: '${onTime.toInt()}%',
                                  color: const Color(0xFF059669),
                                ),
                                _StatPill(
                                  label: l10n.delivered,
                                  value: '$delivered',
                                  color: const Color(0xFF0284C7),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            ClipRect(
                              child: WeeklyBarChart(
                                height: 180,
                                color: const Color(0xFF047857),
                                emptyMessage: l10n.completeDeliveriesForGraph,
                                tooltipLabel: (i) {
                                  final labels = [l10n.ratingLabel, l10n.acceptShort, l10n.onTimeLabel, l10n.declineShort];
                                  final vals = [ratingPct, acceptance, onTime, decline];
                                  final idx = i.clamp(0, 3);
                                  return '${labels[idx]}  ${vals[idx].toStringAsFixed(0)}%';
                                },
                                axisLabel: (v) => '${v.toInt()}',
                                bars: [
                                  ChartBar(label: l10n.ratingLabel, value: ratingPct, highlight: true),
                                  ChartBar(label: l10n.acceptShort, value: acceptance),
                                  ChartBar(label: l10n.onTimeLabel, value: onTime),
                                  ChartBar(label: l10n.declineShort, value: decline, muted: true),
                                ],
                              ),
                            ),
                          ],
                        )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            const SizedBox(height: 12),
                            // Illustration: mint shape with 3 green bars and sparkles
                            SizedBox(
                              width: 72,
                              height: 56,
                              child: Stack(
                                alignment: Alignment.center,
                                clipBehavior: Clip.none,
                                children: [
                                  // Soft mint cloud/blob
                                  Container(
                                    width: 58,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: isDark ? const Color(0xFF064E3B) : const Color(0xFFDCFCE7),
                                      borderRadius: BorderRadius.circular(22),
                                    ),
                                  ),
                                  // 3 vertical green rounded bars
                                  Positioned(
                                    bottom: 12,
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          width: 6,
                                          height: 12,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF10B981),
                                            borderRadius: BorderRadius.circular(3),
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        Container(
                                          width: 6,
                                          height: 24,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF059669),
                                            borderRadius: BorderRadius.circular(3),
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        Container(
                                          width: 6,
                                          height: 18,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF047857),
                                            borderRadius: BorderRadius.circular(3),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Sparkle star 1
                                  const Positioned(
                                    top: 4,
                                    right: 8,
                                    child: Icon(
                                      Icons.auto_awesome,
                                      size: 14,
                                      color: Color(0xFF047857),
                                    ),
                                  ),
                                  // Sparkle star 2
                                  const Positioned(
                                    top: -2,
                                    right: -4,
                                    child: Icon(
                                      Icons.auto_awesome,
                                      size: 10,
                                      color: Color(0xFF10B981),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              l10n.noPerformanceDataYet,
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: isDark ? const Color(0xFFF8FAFC) : const Color(0xFF0F172A),
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              l10n.completeDeliveriesForPerformance,
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w400,
                                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF6B7280),
                                height: 1.4,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 12),
                          ],
                        ),
            ),
          ),
        ),
      ],
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 10.5,
            fontWeight: FontWeight.w500,
            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
          ),
        ),
      ],
    );
  }
}

class _PreOrderHomeCard extends StatelessWidget {
  const _PreOrderHomeCard({required this.count, required this.toScan, required this.onOpen});

  final int count;
  final int toScan;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFA7F3D0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(color: Color(0xFF059669), shape: BoxShape.circle),
            child: const Icon(Icons.event_available_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLocalizations.of(context).preOrdersAssignedToYou(count),
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF065F46),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  toScan > 0
                      ? AppLocalizations.of(context).preOrdersToCollect(toScan)
                      : AppLocalizations.of(context).allCollectedDeliverOneByOne,
                  style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF047857)),
                ),
              ],
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: onOpen,
            child: Text(
              AppLocalizations.of(context).openAction,
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActiveDeliveryCard extends StatelessWidget {
  const _ActiveDeliveryCard({
    required this.onOpen,
    required this.continueLabel,
  });

  final VoidCallback onOpen;
  final String continueLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              color: Color(0xFF2563EB),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.two_wheeler_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLocalizations.of(context).deliveryInProgress,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1E40AF),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  AppLocalizations.of(context).tapToViewOrderDetails,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: const Color(0xFF1D4ED8),
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: onOpen,
            child: Text(
              continueLabel,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Cash on Delivery Warning Banner
/// Shown when the delivery boy has collected cash from customers that must be
/// handed over to the dark store manager till the end of the day.
class _CodCashWarningCard extends StatelessWidget {
  const _CodCashWarningCard({
    required this.amount,
  });

  final double amount;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final formattedAmount = amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2);

    return InkWell(
      onTap: () => Navigator.pushNamed(context, AppRoutes.wallet),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1F1D14) : const Color(0xFFFFFDF0),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark ? const Color(0xFF854D0E) : const Color(0xFFFDE68A),
            width: 1.2,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Wallet icon with small exclamation badge
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: const BoxDecoration(
                    color: Color(0xFFF59E0B),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.account_balance_wallet_outlined,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                ),
                Positioned(
                  bottom: -1,
                  right: -1,
                  child: Container(
                    width: 13,
                    height: 13,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD97706),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isDark ? const Color(0xFF1F1D14) : const Color(0xFFFFFDF0),
                        width: 1.2,
                      ),
                    ),
                    child: const Center(
                      child: Text(
                        '!',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w900,
                          height: 1,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 10),

            // Title and concise subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        AppLocalizations.of(context).cashDepositDue,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: isDark ? const Color(0xFFFDE68A) : const Color(0xFF1E293B),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        AppLocalizations.of(context).detailsAction,
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: isDark ? const Color(0xFF34D399) : const Color(0xFF047857),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 1),
                  Text(
                    AppLocalizations.of(context).handOverToStoreToday,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),

            // Amount pill + chevron
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF78350F) : const Color(0xFFFEF08A),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '₹$formattedAmount',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: isDark ? const Color(0xFFFEF08A) : const Color(0xFF0F172A),
                    ),
                  ),
                ),
                const SizedBox(width: 2),
                Icon(
                  Icons.chevron_right_rounded,
                  color: isDark ? const Color(0xFF34D399) : const Color(0xFF047857),
                  size: 18,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HrAnnouncementCard extends StatelessWidget {
  const _HrAnnouncementCard({
    required this.title,
    required this.body,
    this.kind = 'announcement',
    this.status = 'published',
    this.date,
    this.onRead,
  });

  final String title;
  final String body;
  final String kind;
  final String status;
  final String? date;
  final VoidCallback? onRead;

  @override
  Widget build(BuildContext context) {
    final isShift = kind == 'shift';
    final isHoliday = kind == 'holiday';
    final isNote = kind == 'note';
    final isUpcoming = status == 'scheduled';
    final bg = isHoliday
        ? const Color(0xFFFFF1F2)
        : isShift
            ? const Color(0xFFEFF6FF)
            : isNote
                ? const Color(0xFFFFF7ED)
                : isUpcoming
                    ? const Color(0xFFFFFBEB)
                    : const Color(0xFFF5F3FF);
    final border = isHoliday
        ? const Color(0xFFFECDD3)
        : isShift
            ? const Color(0xFFBFDBFE)
            : isNote
                ? const Color(0xFFFED7AA)
                : isUpcoming
                    ? const Color(0xFFFDE68A)
                    : const Color(0xFFDDD6FE);
    final labelColor = isHoliday
        ? const Color(0xFFBE123C)
        : isShift
            ? const Color(0xFF1D4ED8)
            : isNote
                ? const Color(0xFFC2410C)
                : isUpcoming
                    ? const Color(0xFFB45309)
                    : const Color(0xFF6D28D9);
    final titleColor = isHoliday
        ? const Color(0xFF9F1239)
        : isShift
            ? const Color(0xFF1E3A8A)
            : isNote
                ? const Color(0xFF9A3412)
                : isUpcoming
                    ? const Color(0xFF78350F)
                    : const Color(0xFF4C1D95);
    final bodyColor = isHoliday
        ? const Color(0xFFBE123C)
        : isShift
            ? const Color(0xFF1E40AF)
            : isNote
                ? const Color(0xFFC2410C)
                : isUpcoming
                    ? const Color(0xFF92400E)
                    : const Color(0xFF5B21B6);
    final l10n = AppLocalizations.of(context);
    final label = (isHoliday
            ? l10n.kindHoliday
            : isShift
                ? l10n.kindShift
                : isNote
                    ? l10n.kindNote
                    : isUpcoming
                        ? l10n.kindUpcoming
                        : l10n.notificationAnnouncement)
        .toUpperCase();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                    color: labelColor,
                  ),
                ),
              ),
              if ((date ?? '').isNotEmpty)
                Text(
                  date!,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: bodyColor,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: titleColor,
            ),
          ),
          if (body.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              body,
              style: GoogleFonts.inter(
                fontSize: 13,
                height: 1.35,
                color: bodyColor,
              ),
            ),
          ],
          if (onRead != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onRead,
                style: TextButton.styleFrom(
                  foregroundColor: labelColor,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const Icon(Icons.done_all_rounded, size: 16),
                label: Text(
                  AppLocalizations.of(context).markAsRead,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _VerifiedBanner extends StatelessWidget {
  const _VerifiedBanner({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFA7F3D0)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_rounded, color: Color(0xFF059669)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF065F46),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _VerificationNoticeCard extends StatelessWidget {
  const _VerificationNoticeCard({
    required this.pending,
    required this.rejected,
    required this.manager,
    required this.loading,
  });

  final bool pending;
  final bool rejected;
  final AreaManagerInfo? manager;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = rejected
        ? (isDark ? const Color(0xFF3F1D1D) : const Color(0xFFFEF2F2))
        : (isDark ? const Color(0xFF3B2F14) : const Color(0xFFFFFBEB));
    final border = rejected ? const Color(0xFFFECACA) : const Color(0xFFFDE68A);
    final iconColor = rejected ? AppColors.error : AppColors.warning;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                rejected ? Icons.cancel_outlined : Icons.warning_amber_rounded,
                color: iconColor,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  rejected
                      ? AppLocalizations.of(context).verificationRejectedTitle
                      : AppLocalizations.of(context).verificationPendingTitle,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (pending) ...[
            Text(
              AppLocalizations.of(context).verificationPendingBody,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              AppLocalizations.of(context).verificationPendingDarkStoreHint,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
          ] else if (rejected) ...[
            Text(
              AppLocalizations.of(context).verificationRejectedBody,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.error,
                  ),
            ),
          ],
          if (loading) ...[
            const SizedBox(height: AppSpacing.md),
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ] else if (manager != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.storefront_rounded, size: 18, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        manager!.storeName,
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    manager!.storeAddress,
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
