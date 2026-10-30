import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/theme/store_chrome.dart';
import '../../core/utils/product_search.dart';
import '../../features/home/home_providers.dart';
import '../common/voice_mic_button.dart';

/// Matches frontend `MobileSearchBar.jsx` — pill shape, search icon, "Go" CTA.
class MobileSearchBar extends ConsumerStatefulWidget {
  const MobileSearchBar({
    super.key,
    this.autoFocus = false,
    this.onSubmitted,
    this.focusNode,
    this.initialQuery,
  });

  final bool autoFocus;
  final VoidCallback? onSubmitted;
  final FocusNode? focusNode;
  final String? initialQuery;

  @override
  ConsumerState<MobileSearchBar> createState() => _MobileSearchBarState();
}

class _MobileSearchBarState extends ConsumerState<MobileSearchBar> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  late final bool _ownsFocusNode;
  String? _lastSyncedQuery;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialQuery?.trim() ?? '');
    _ownsFocusNode = widget.focusNode == null;
    _focusNode = widget.focusNode ?? FocusNode();
    _lastSyncedQuery = _controller.text;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final q = GoRouterState.of(context).uri.queryParameters['q']?.trim() ?? '';
    if (q == _lastSyncedQuery) return;
    _lastSyncedQuery = q;
    if (_controller.text != q) {
      _controller.text = q;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    if (_ownsFocusNode) _focusNode.dispose();
    super.dispose();
  }

  void _submit() {
    final query = _controller.text.trim();
    if (query.isEmpty) return;
    context.go(ProductSearch.buildPath(query: query));
    widget.onSubmitted?.call();
  }

  void _applyTranscript(String text, bool isFinal) {
    _controller.value = TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
    if (isFinal) _submit();
  }

  @override
  Widget build(BuildContext context) {
    final hint = StoreChrome.forStore(ref.watch(selectedStoreTabProvider)).searchHint;
    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.borderLight),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D000000),
              blurRadius: 2,
              offset: Offset(0, 1),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        child: Row(
          children: [
            const Icon(
              Icons.search_rounded,
              color: AppColors.textSecondary,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _controller,
                focusNode: _focusNode,
                autofocus: widget.autoFocus,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _submit(),
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: hint,
                  hintStyle: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 14,
                  ),
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  focusedErrorBorder: InputBorder.none,
                  isDense: true,
                  isCollapsed: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
            VoiceMicButton(onTranscript: _applyTranscript),
          ],
        ),
      ),
    );
  }
}
