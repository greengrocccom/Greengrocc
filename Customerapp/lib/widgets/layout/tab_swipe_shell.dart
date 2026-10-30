import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_controller.dart';
import '../../features/auth/auth_host.dart';
import '../../routes/route_paths.dart';


/// Broadcast hub for shell branch stack changes.
final shellBranchNavigatorHub = ShellBranchNavigatorHub();

class ShellBranchNavigatorHub {
  final _listeners = <VoidCallback>{};

  void addListener(VoidCallback listener) => _listeners.add(listener);

  void removeListener(VoidCallback listener) => _listeners.remove(listener);

  void notify() {
    for (final listener in List<VoidCallback>.of(_listeners)) {
      listener();
    }
  }
}

/// One instance per shell branch navigator — do not share across navigators.
class ShellBranchNavigatorObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      shellBranchNavigatorHub.notify();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      shellBranchNavigatorHub.notify();

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      shellBranchNavigatorHub.notify();

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      shellBranchNavigatorHub.notify();
}

/// Swipeable main-tab container synced with [StatefulNavigationShell].
class TabSwipeShell extends ConsumerStatefulWidget {
  const TabSwipeShell({
    super.key,
    required this.navigationShell,
    required this.children,
    required this.branchNavigatorKeys,
  });

  final StatefulNavigationShell navigationShell;
  final List<Widget> children;
  final List<GlobalKey<NavigatorState>> branchNavigatorKeys;

  @override
  ConsumerState<TabSwipeShell> createState() => _TabSwipeShellState();
}

class _TabSwipeShellState extends ConsumerState<TabSwipeShell> {
  static const _visualToShell = [0, 2, 1, 3, 4];
  static const _shellToVisual = [0, 2, 1, 3, 4];

  late final PageController _pageController;
  bool _syncingFromShell = false;
  bool _stackRebuildScheduled = false;
  bool _isOnBranchRoot = true;

  int _shellToVisualIdx(int shellIndex) {
    if (shellIndex < 0 || shellIndex >= _shellToVisual.length) return 0;
    return _shellToVisual[shellIndex];
  }

  int _visualToShellIdx(int visualIndex) {
    if (visualIndex < 0 || visualIndex >= _visualToShell.length) return 0;
    return _visualToShell[visualIndex];
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController(
      initialPage: _shellToVisualIdx(widget.navigationShell.currentIndex),
    );
    shellBranchNavigatorHub.addListener(_onBranchStackChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncBranchRootState());
  }

  void _onBranchStackChanged() {
    if (!mounted || _stackRebuildScheduled) return;
    _stackRebuildScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _stackRebuildScheduled = false;
      _syncBranchRootState();
    });
  }

  @override
  void didUpdateWidget(TabSwipeShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    final targetShell = widget.navigationShell.currentIndex;
    final targetVisual = _shellToVisualIdx(targetShell);
    if (targetVisual != _pageController.page?.round()) {
      _syncingFromShell = true;
      _pageController
          .animateToPage(
            targetVisual,
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOutCubic,
          )
          .whenComplete(() {
        if (mounted) _syncingFromShell = false;
      });
    }

    _syncBranchRootState();
  }

  @override
  void dispose() {
    shellBranchNavigatorHub.removeListener(_onBranchStackChanged);
    _pageController.dispose();
    super.dispose();
  }

  bool _computeIsOnBranchRoot() {
    final index = widget.navigationShell.currentIndex;
    if (index < 0 || index >= widget.branchNavigatorKeys.length) {
      return true;
    }
    final navigator = widget.branchNavigatorKeys[index].currentState;
    return !(navigator?.canPop() ?? false);
  }

  void _syncBranchRootState() {
    if (!mounted) return;
    final next = _computeIsOnBranchRoot();
    if (next == _isOnBranchRoot) return;
    setState(() => _isOnBranchRoot = next);
  }

  void _onPageChanged(int visualIndex) {
    if (_syncingFromShell) return;

    final shellIndex = _visualToShellIdx(visualIndex);
    if (shellIndex == widget.navigationShell.currentIndex) return;

    final isOrderAgainTab = visualIndex == 1;
    final isAccountTab = visualIndex == 4;
    final isProtectedTab = isOrderAgainTab || isAccountTab;

    if (isProtectedTab && !ref.read(authControllerProvider).isLoggedIn) {
      final currentVisual = _shellToVisualIdx(widget.navigationShell.currentIndex);
      _pageController.animateToPage(
        currentVisual,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
      );
      final targetRoute = isAccountTab ? RoutePaths.profile : RoutePaths.orders;
      showAuthModalBottomSheet(
        context,
        ref,
        mode: AuthModalMode.login,
        redirectRoute: targetRoute,
      );
      return;
    }

    _syncBranchRootState();
    HapticFeedback.lightImpact();
    widget.navigationShell.goBranch(shellIndex, initialLocation: false);
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      controller: _pageController,
      physics: _isOnBranchRoot
          ? const PageScrollPhysics()
          : const NeverScrollableScrollPhysics(),
      onPageChanged: _onPageChanged,
      allowImplicitScrolling: false,
      itemCount: widget.children.length,
      itemBuilder: (context, visualIndex) {
        final shellIndex = _visualToShellIdx(visualIndex);
        return widget.children[shellIndex];
      },
    );
  }
}
