import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../config/theme.dart';
import '../../../core/scroll/vertical_scroll_pause_scope.dart';
import '../../../core/utils/viewport_utils.dart';
import 'home_section_card.dart';

const _cardHeight = 96.0;

class WhyChooseUsSection extends StatefulWidget {
  const WhyChooseUsSection({super.key});

  @override
  State<WhyChooseUsSection> createState() => _WhyChooseUsSectionState();
}

class _WhyChooseUsSectionState extends State<WhyChooseUsSection>
    with WidgetsBindingObserver {
  static const _features = [
    _WhyChooseFeature(
      line1: 'Fresh groceries daily',
      line2: 'quality you can trust',
      color: Color(0xFF0C831F),
      iconBg: Color(0xFFDCFCE7),
      icon: Icons.eco_outlined,
    ),
    _WhyChooseFeature(
      line1: 'Fast delivery',
      line2: 'to your doorstep',
      color: Color(0xFF059669),
      iconBg: Color(0xFFD1FAE5),
      icon: Icons.delivery_dining_outlined,
    ),
    _WhyChooseFeature(
      line1: 'Best prices',
      line2: 'on everyday essentials',
      color: Color(0xFF047857),
      iconBg: Color(0xFFECFDF5),
      icon: Icons.local_offer_outlined,
    ),
    _WhyChooseFeature(
      line1: 'Wide assortment',
      line2: 'fruits to pantry staples',
      color: Color(0xFF0C831F),
      iconBg: Color(0xFFDCFCE7),
      icon: Icons.shopping_basket_outlined,
    ),
    _WhyChooseFeature(
      line1: 'Easy returns',
      line2: 'hassle-free support',
      color: Color(0xFF0284C7),
      iconBg: Color(0xFFE0F2FE),
      icon: Icons.replay_outlined,
    ),
    _WhyChooseFeature(
      line1: 'Always here to help',
      line2: 'quick customer support',
      color: Color(0xFFE11D48),
      iconBg: Color(0xFFFFE4E6),
      icon: Icons.support_agent_outlined,
    ),
  ];

  static const _viewportFraction = 0.88;
  static const _autoSlideInterval = Duration(milliseconds: 3200);
  static const _transitionDuration = Duration(milliseconds: 550);

  late final PageController _pageController;
  Timer? _autoTimer;
  int _currentPage = 0;
  bool _paused = false;
  bool _appActive = true;
  bool _pageMoveQueued = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pageController = PageController(
      viewportFraction: _viewportFraction,
    );
    _startAutoSlide();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final active = state == AppLifecycleState.resumed;
    if (_appActive == active) return;
    _appActive = active;
    if (active) {
      _startAutoSlide();
    } else {
      _autoTimer?.cancel();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoSlide() {
    _autoTimer?.cancel();
    if (!_appActive || _features.length <= 1) return;

    _autoTimer = Timer.periodic(_autoSlideInterval, (_) {
      if (!mounted || _paused || !_pageController.hasClients) return;
      if (VerticalScrollPauseScope.isParentVerticalScrolling(context)) return;
      if (!isWidgetRoughlyVisible(context)) return;

      final next = (_currentPage + 1) % _features.length;
      _queueSafePageMove(next, animated: !MediaQuery.disableAnimationsOf(context));
    });
  }

  void _queueSafePageMove(int page, {required bool animated}) {
    if (_pageMoveQueued) return;
    _pageMoveQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _pageMoveQueued = false;
      if (!mounted || !_pageController.hasClients) return;
      if (SchedulerBinding.instance.schedulerPhase ==
          SchedulerPhase.persistentCallbacks) {
        _queueSafePageMove(page, animated: animated);
        return;
      }
      if (animated) {
        _pageController.animateToPage(
          page,
          duration: _transitionDuration,
          curve: Curves.easeInOutCubic,
        );
      } else {
        _pageController.jumpToPage(page);
      }
    });
  }

  void _setPaused(bool value) {
    if (_paused == value) return;
    setState(() => _paused = value);
  }

  @override
  Widget build(BuildContext context) {
    return HomeSectionCard(
      margin: const EdgeInsets.fromLTRB(0, 8, 0, 8),
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
      showDivider: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RichText(
            text: const TextSpan(
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                height: 1.25,
                color: AppColors.textPrimary,
              ),
              children: [
                TextSpan(text: 'Why Choose '),
                TextSpan(
                  text: 'GreenGrocc?',
                  style: TextStyle(color: AppColors.primary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Fresh prices, quality products & fast delivery',
            style: TextStyle(
              fontSize: 13,
              height: 1.35,
              color: AppColors.textSecondary.withValues(alpha: 0.95),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: _cardHeight,
            child: Listener(
              onPointerDown: (_) => _setPaused(true),
              onPointerUp: (_) => _setPaused(false),
              onPointerCancel: (_) => _setPaused(false),
              child: NotificationListener<ScrollNotification>(
                onNotification: (notification) {
                  if (notification is ScrollStartNotification &&
                      notification.dragDetails != null) {
                    _setPaused(true);
                  } else if (notification is ScrollEndNotification) {
                    _setPaused(false);
                  }
                  return false;
                },
                child: PageView.builder(
                  controller: _pageController,
                  padEnds: true,
                  itemCount: _features.length,
                  onPageChanged: (index) => setState(() => _currentPage = index),
                  itemBuilder: (context, index) {
                    final feature = _features[index];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: _WhyChooseCard(feature: feature),
                    );
                  },
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_features.length, (index) {
              final active = index == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 16 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active
                      ? AppColors.primary
                      : AppColors.borderLight,
                  borderRadius: BorderRadius.circular(99),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _WhyChooseFeature {
  const _WhyChooseFeature({
    required this.line1,
    required this.line2,
    required this.color,
    required this.iconBg,
    required this.icon,
  });

  final String line1;
  final String line2;
  final Color color;
  final Color iconBg;
  final IconData icon;
}

class _WhyChooseCard extends StatelessWidget {
  const _WhyChooseCard({required this.feature});

  final _WhyChooseFeature feature;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _cardHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.borderLight.withValues(alpha: 0.85),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ColoredBox(
                color: feature.color.withValues(alpha: 0.12),
                child: const SizedBox(width: 4),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: feature.iconBg,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          feature.icon,
                          color: feature.color,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              feature.line1,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                height: 1.2,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              feature.line2,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11.5,
                                height: 1.2,
                                color: AppColors.textSecondary
                                    .withValues(alpha: 0.95),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              width: 28,
                              height: 3,
                              decoration: BoxDecoration(
                                color: feature.color,
                                borderRadius: BorderRadius.circular(99),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
