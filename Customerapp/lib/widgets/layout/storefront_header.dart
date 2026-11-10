import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/utils/product_search.dart';
import '../../features/cart/cart_controller.dart';
import '../../routes/route_paths.dart';

const kWebPrimary = Color(0xFF22C55E);
const kWebGreen = Color(0xFF0C831F);
const kWebBorder = Color(0xFFE5E5E5);
const kWebTextSecondary = Color(0xFF666666);
const kWebTextMuted = Color(0xFF999999);

/// Website `MobileHeader.jsx`: logo, rounded search with "Go", cart button.
class StorefrontHeader extends StatelessWidget {
  const StorefrontHeader({super.key, this.leading});

  /// Replaces the logo + search (the web shop page shows a category picker).
  final Widget? leading;

  static const double contentHeight = 61;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
      child: Container(
        padding: EdgeInsets.fromLTRB(12, topInset + 10, 12, 10),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: Color(0xFFF3F4F6))),
          boxShadow: [BoxShadow(color: Color(0x05000000), blurRadius: 10, offset: Offset(0, 2))],
        ),
        child: Row(
          children: [
            if (leading != null)
              Expanded(child: leading!)
            else ...[
              GestureDetector(
                onTap: () => context.go(RoutePaths.home),
                child: Image.asset('assets/images/web_logo.png', height: 40, fit: BoxFit.contain),
              ),
              const SizedBox(width: 10),
              const Expanded(child: WebSearchPill()),
            ],
            const SizedBox(width: 10),
            const HeaderCartButton(),
          ],
        ),
      ),
    );
  }
}

/// Website `MobileSearchBar.jsx` — pill input with a green "Go" button.
class WebSearchPill extends StatefulWidget {
  const WebSearchPill({super.key, this.autoFocus = false});

  final bool autoFocus;

  @override
  State<WebSearchPill> createState() => _WebSearchPillState();
}

class _WebSearchPillState extends State<WebSearchPill> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final q = _controller.text.trim();
    if (q.isEmpty) return;
    FocusScope.of(context).unfocus();
    context.go(ProductSearch.buildPath(query: q));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.fromLTRB(12, 0, 6, 0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: kWebBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.search_rounded, size: 16, color: kWebTextSecondary),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _controller,
              autofocus: widget.autoFocus,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _submit(),
              style: GoogleFonts.plusJakartaSans(fontSize: 14, color: Colors.black),
              decoration: InputDecoration(
                hintText: 'Search Products...',
                hintStyle: GoogleFonts.plusJakartaSans(fontSize: 14, color: kWebTextMuted),
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                isCollapsed: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _submit,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: kWebPrimary,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                'Go',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Round cart link with a count badge (website header cart).
class HeaderCartButton extends ConsumerWidget {
  const HeaderCartButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartControllerProvider.select((s) => s.cartCount));
    return GestureDetector(
      onTap: () => context.go(RoutePaths.cart),
      child: SizedBox(
        width: 40,
        height: 40,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: kWebGreen.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.shopping_cart_outlined, size: 22, color: kWebGreen),
            ),
            if (count > 0)
              Positioned(
                right: -4,
                top: -4,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: kWebGreen,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    count > 99 ? '99+' : '$count',
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
