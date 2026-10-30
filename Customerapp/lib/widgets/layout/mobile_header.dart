import 'package:flutter/material.dart';

class MobileHeader extends StatelessWidget {
  const MobileHeader({
    super.key,
    this.isHomeTab = false,
  });

  final bool isHomeTab;

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
