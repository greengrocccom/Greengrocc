import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/store_chrome.dart';
import '../../../routes/route_paths.dart';
import '../../../widgets/common/offers_badge_button.dart';
import '../home_providers.dart';

class HomeSearchBar extends ConsumerStatefulWidget {
  final bool isLightBg;
  final String? hintText;
  final bool showBackButton;
  final String? initialQuery;
  final ValueChanged<String>? onSubmitted;

  const HomeSearchBar({
    super.key,
    this.isLightBg = false,
    this.hintText,
    this.showBackButton = false,
    this.initialQuery,
    this.onSubmitted,
  });

  @override
  ConsumerState<HomeSearchBar> createState() => _HomeSearchBarState();
}

class _HomeSearchBarState extends ConsumerState<HomeSearchBar> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      _controller.text = widget.initialQuery!;
    }
    _controller.addListener(_onTextChanged);
  }

  @override
  void didUpdateWidget(HomeSearchBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialQuery != oldWidget.initialQuery &&
        widget.initialQuery != null &&
        widget.initialQuery != _controller.text) {
      _controller.text = widget.initialQuery!;
    }
  }

  void _onTextChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submitSearch(String query) {
    final trimmed = query.trim();
    if (widget.onSubmitted != null) {
      widget.onSubmitted!(trimmed);
      return;
    }
    if (trimmed.isEmpty) {
      context.push(RoutePaths.product);
      return;
    }
    context.push('${RoutePaths.product}?q=${Uri.encodeComponent(trimmed)}');
  }

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(selectedStoreTabProvider);
    final hint = widget.hintText ?? StoreChrome.forStore(store).searchHint;
    final canGoBack =
        widget.showBackButton && (context.canPop() || Navigator.canPop(context));

    return Container(
      color: Colors.transparent,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          if (canGoBack) ...[
            SizedBox(
              width: 32,
              height: 36,
              child: IconButton(
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go(RoutePaths.home);
                  }
                },
                icon: const Icon(
                  Icons.arrow_back_rounded,
                  color: Color(0xFF0F172A),
                  size: 22,
                ),
                padding: EdgeInsets.zero,
                visualDensity: VisualDensity.compact,
              ),
            ),
            const SizedBox(width: 4),
          ],
          Expanded(
            child: GestureDetector(
              onTap: () {
                _focusNode.requestFocus();
              },
              child: Container(
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                padding: const EdgeInsets.only(left: 12, right: 2),
                child: Row(
                  children: [
                    const Icon(
                      Icons.search_rounded,
                      color: Color(0xFF64748B),
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        onSubmitted: _submitSearch,
                        textInputAction: TextInputAction.search,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF111827),
                        ),
                        decoration: InputDecoration(
                          hintText: hint,
                          hintStyle: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFF94A3B8),
                          ),
                          filled: false,
                          isCollapsed: true,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                          errorBorder: InputBorder.none,
                          focusedErrorBorder: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                    if (_controller.text.isNotEmpty)
                      GestureDetector(
                        onTap: _controller.clear,
                        child: const Padding(
                          padding: EdgeInsets.only(left: 4),
                          child: Icon(
                            Icons.cancel_rounded,
                            color: Color(0xFF64748B),
                            size: 18,
                          ),
                        ),
                      ),
                    const SizedBox(width: 10),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          const OffersBadgeButton(height: 36),
        ],
      ),
    );
  }
}
