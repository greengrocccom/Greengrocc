import 'package:flutter/material.dart';

/// Reports its render bounds to a callback — one local key per anchor instance.
class FlyTargetAnchor extends StatefulWidget {
  const FlyTargetAnchor({
    super.key,
    required this.child,
    required this.onReport,
    required this.onClear,
  });

  final Widget child;
  final void Function(RenderBox? box) onReport;
  final VoidCallback onClear;

  @override
  State<FlyTargetAnchor> createState() => _FlyTargetAnchorState();
}

class _FlyTargetAnchorState extends State<FlyTargetAnchor> {
  final _key = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _report());
  }

  @override
  void dispose() {
    widget.onClear();
    super.dispose();
  }

  void _report() {
    if (!mounted) return;
    final box = _key.currentContext?.findRenderObject();
    widget.onReport(box is RenderBox ? box : null);
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _report());
    return SizedBox(
      key: _key,
      child: widget.child,
    );
  }
}
