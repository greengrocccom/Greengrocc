import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'splash_screen_view.dart';

class OpeningSplashHost extends StatefulWidget {
  const OpeningSplashHost({super.key, required this.child});

  final Widget child;

  @override
  State<OpeningSplashHost> createState() => _OpeningSplashHostState();
}

class _OpeningSplashHostState extends State<OpeningSplashHost>
    with SingleTickerProviderStateMixin {
  /// How long the splash screen stays fully visible before fading out
  static const _splashVisibleDuration = Duration(milliseconds: 2300);

  /// Smooth fade-out duration when revealing the app
  static const _fadeDuration = Duration(milliseconds: 450);

  AnimationController? _controller;
  Animation<double>? _overlayOpacity;

  bool _showOverlay = true;
  bool _animationsEnabled = true;

  @override
  void initState() {
    super.initState();
    final reduceMotion = MediaQueryData.fromView(
      WidgetsBinding.instance.platformDispatcher.views.first,
    ).disableAnimations;

    if (reduceMotion) {
      _animationsEnabled = false;
      _showOverlay = false;
      return;
    }

    final controller = AnimationController(
      vsync: this,
      duration: _fadeDuration,
    );
    _controller = controller;

    _overlayOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: controller,
        curve: Curves.easeInOutCubic,
      ),
    );

    // Give user time to enjoy the animated splash screen, then fade into the app.
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _controller == null) return;
      Future.delayed(_splashVisibleDuration, () {
        if (!mounted || _controller == null) return;
        _controller!.forward();
      });
    });

    controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _showOverlay = false);
      }
    });
  }

  void _skipSplash() {
    if (_controller != null && !_controller!.isAnimating && !_controller!.isCompleted) {
      _controller!.forward();
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_animationsEnabled) {
      return widget.child;
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (_showOverlay)
          RepaintBoundary(
            child: AnimatedBuilder(
              animation: _controller!,
              builder: (context, _) {
                final overlayOpacity = _overlayOpacity?.value ?? 1.0;
                return IgnorePointer(
                  ignoring: overlayOpacity < 0.1,
                  child: Opacity(
                    opacity: overlayOpacity.clamp(0.0, 1.0),
                    child: GestureDetector(
                      onTap: _skipSplash,
                      behavior: HitTestBehavior.opaque,
                      child: const SplashScreenView(),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
