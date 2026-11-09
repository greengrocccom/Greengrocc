import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/l10n/app_l10n.dart';
import '../../../core/routes/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../data/services/notification_inbox_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../shell/shell_navigation.dart';
import 'notification_text.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _inbox = NotificationInboxService.instance;

  @override
  void initState() {
    super.initState();
    _inbox.ensureSocketListeners();
    _inbox.addListener(_onInbox);
    _inbox.refresh();
  }

  @override
  void dispose() {
    _inbox.removeListener(_onInbox);
    super.dispose();
  }

  void _onInbox() {
    if (mounted) setState(() {});
  }

  String _timeLabel(DateTime? when) {
    if (when == null) return '';
    final local = when.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(local.year, local.month, local.day);
    final clock = localizedDateFormat('h:mm a').format(local);
    if (day == today) return clock;
    if (day == today.subtract(const Duration(days: 1))) return AppLocalizations.of(context).yesterday;
    return '${local.day}/${local.month}/${local.year}';
  }

  void _openRelated(RiderNotification item) {
    _inbox.markRead(item.id);
    final screen = item.screen.toLowerCase();
    final type = item.type.toUpperCase();

    if (screen == 'preorder_deliveries') {
      Navigator.pushNamed(context, AppRoutes.preOrderDeliveries);
      return;
    }
    if (screen == 'assigned_orders' || type == 'ORDER_ASSIGNED') {
      Navigator.pushNamed(context, AppRoutes.assignedOrders);
      return;
    }
    if (screen == 'wallet' ||
        type == 'ORDER_COMPLETED' ||
        type == 'WALLET_CREDITED') {
      if (widget.embedded) {
        ShellNavigation.instance.goToTab(3);
      } else {
        Navigator.pushNamed(context, AppRoutes.deliveryHistory);
      }
      return;
    }
    if (screen == 'shifts' ||
        type == 'SHIFT_STARTED' ||
        type == 'SHIFT_REMINDER') {
      if (widget.embedded) {
        ShellNavigation.instance.goToTab(1);
      } else {
        Navigator.pushNamed(context, AppRoutes.myShifts);
      }
      return;
    }
    if (screen == 'gigs' || type == 'NEW_GIG') {
      Navigator.pushNamed(context, AppRoutes.gigs);
      return;
    }
    if (type == 'ORDER_RECEIVED') {
      if (widget.embedded) {
        ShellNavigation.instance.goToTab(0);
      } else {
        Navigator.pushNamed(context, AppRoutes.home);
      }
      final orderId = item.orderId ?? '';
      ShellNavigation.instance.requestOfferRecovery(
        orderId: orderId,
        reason: 'ORDER_RECEIVED',
      );
      return;
    }
    if (type == 'VERIFICATION_COMPLETED') {
      if (widget.embedded) {
        ShellNavigation.instance.goToTab(0);
      } else {
        Navigator.pushNamed(context, AppRoutes.home);
      }
    }
  }

  Future<void> _confirmClearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(AppLocalizations.of(context).clearAllNotificationsTitle),
        content: Text(AppLocalizations.of(context).clearAllNotificationsBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(AppLocalizations.of(context).cancel)),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(AppLocalizations.of(context).clearAll),
          ),
        ],
      ),
    );
    if (ok == true) await _inbox.clearAll();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final items = _inbox.items;
    final topInset = MediaQuery.paddingOf(context).top;

    final list = RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _inbox.refresh,
      child: _inbox.loading && items.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 160),
                Center(child: CircularProgressIndicator()),
              ],
            )
          : items.isEmpty
              ? ListView(
                  children: [
                    const SizedBox(height: 120),
                    Icon(
                      Icons.notifications_none_rounded,
                      size: 52,
                      color: Colors.grey.shade400,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      l10n.noNotificationsYet,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      l10n.noNotificationsHint,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.only(bottom: 24),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    thickness: 1,
                    color: AppColors.cardBorder,
                  ),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    final text = localizedNotification(l10n, item);
                    return _NotificationRow(
                      id: item.id,
                      title: text.title,
                      body: text.body,
                      category: '${item.type} ${item.title}',
                      time: _timeLabel(item.createdAt),
                      isUnread: !item.isRead,
                      onTap: () => _openRelated(item),
                      onDismiss: () => _inbox.deleteOne(item.id),
                    );
                  },
                ),
    );

    final isDark = Theme.of(context).brightness == Brightness.dark;

    final body = Column(
      children: [
        Container(
          width: double.infinity,
          color: isDark ? const Color(0xFF0F172A) : AppColors.primaryDark,
          padding: EdgeInsets.fromLTRB(8, topInset + 4, 8, 14),
          child: Row(
            children: [
              if (!widget.embedded)
                IconButton(
                  onPressed: () => Navigator.maybePop(context),
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                )
              else
                Builder(
                  builder: (ctx) => IconButton(
                    onPressed: () => Scaffold.of(ctx).openDrawer(),
                    icon: const Icon(Icons.menu, color: Colors.white),
                  ),
                ),
              Expanded(
                child: Text(
                  l10n.notifications,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 48),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
          child: Container(
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.cardBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: items.isEmpty ? null : _inbox.markAllRead,
                    borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.done_all_rounded,
                            size: 16,
                            color: isDark ? const Color(0xFF34D399) : AppColors.primary,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            l10n.markAllAsRead,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF374151),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Container(width: 1, height: 22, color: AppColors.cardBorder),
                Expanded(
                  child: InkWell(
                    onTap: items.isEmpty ? null : _confirmClearAll,
                    borderRadius: const BorderRadius.horizontal(
                      right: Radius.circular(12),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.delete_outline_rounded,
                            size: 16,
                            color: Color(0xFFEF4444),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            l10n.clearAll,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(child: list),
      ],
    );

    return ColoredBox(
      color: AppColors.background,
      child: body,
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    required this.time,
    required this.isUnread,
    required this.onTap,
    required this.onDismiss,
  });

  final String id;
  final String title;
  final String body;
  final String category;
  final String time;
  final bool isUnread;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Detect category emoji
    final tLower = category.toLowerCase();
    final bLower = tLower;
    String emoji = '🔔';
    Color emojiBg = isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9);

    if (tLower.contains('order') || bLower.contains('order') || tLower.contains('deliver')) {
      emoji = '📦';
      emojiBg = isDark ? const Color(0xFF064E3B) : const Color(0xFFECFDF5);
    } else if (tLower.contains('wallet') || tLower.contains('credit') || tLower.contains('payout') || tLower.contains('cash') || tLower.contains('earning')) {
      emoji = '💰';
      emojiBg = isDark ? const Color(0xFF451A03) : const Color(0xFFFEF3C7);
    } else if (tLower.contains('shift') || bLower.contains('shift') || tLower.contains('slot')) {
      emoji = '⏰';
      emojiBg = isDark ? const Color(0xFF1E1B4B) : const Color(0xFFEEF2FF);
    } else if (tLower.contains('gig') || tLower.contains('incentive') || tLower.contains('bonus')) {
      emoji = '🎯';
      emojiBg = isDark ? const Color(0xFF3B0764) : const Color(0xFFFAF5FF);
    }

    return Dismissible(
      key: ValueKey(id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => onDismiss(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: const Color(0xFFDC2626),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 12, 10),
          color: isUnread
              ? (isDark ? const Color(0xFF0F1E19) : const Color(0xFFF0FDF4))
              : Colors.transparent,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: emojiBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(emoji, style: const TextStyle(fontSize: 16)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        if (isUnread) ...[
                          Container(
                            width: 6,
                            height: 6,
                            margin: const EdgeInsets.only(right: 6),
                            decoration: const BoxDecoration(
                              color: Color(0xFF10B981),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                        Expanded(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: isUnread ? FontWeight.w800 : FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          time,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      body,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        height: 1.25,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
