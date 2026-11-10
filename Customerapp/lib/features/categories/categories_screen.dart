import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/providers/app_providers.dart';
import '../../core/scroll/app_scroll_config.dart';
import '../../core/scroll/tab_scroll_registry.dart';
import '../../models/category.dart';
import '../../routes/route_paths.dart';
import '../../widgets/common/app_network_image.dart';
import '../../widgets/layout/storefront_header.dart';
import '../home/home_providers.dart';
import '../home/widgets/home_footer.dart';
import '../home/widgets/home_header_category_strip.dart';

/// Admin → Sections (name, badge, colour, description) keyed by slug.
final sectionsMetaProvider = FutureProvider<Map<String, Map<String, dynamic>>>((ref) async {
  final sections = await ref.read(apiServiceProvider).fetchSections(null, ref);
  return {
    for (final s in sections)
      (s['slug'] ?? s['storeType'] ?? '').toString().toLowerCase(): s,
  };
});

Color? _hex(String? value) {
  var hex = (value ?? '').trim().replaceAll('#', '');
  if (hex.length == 3) hex = hex.split('').map((c) => '$c$c').join();
  if (hex.length != 6) return null;
  final n = int.tryParse(hex, radix: 16);
  return n == null ? null : Color(0xFF000000 | n);
}

/// Website `pages/Categories.jsx`.
class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});

  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  late final TabScrollRegistry _tabScrollRegistry;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabScrollRegistry = ref.read(tabScrollRegistryProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tabScrollRegistry.register(ShellTabIndex.categories, _scrollController);
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(categoriesProvider);
    ref.invalidate(sectionsMetaProvider);
    await ref.read(categoriesProvider.future).catchError((_) => <Category>[]);
  }

  @override
  void dispose() {
    _tabScrollRegistry.unregister(ShellTabIndex.categories, _scrollController);
    _scrollController.dispose();
    super.dispose();
  }

  void _onCategoryTapped(String categoryName) {
    ref.read(selectedCategoryHeaderTabProvider.notifier).setCategory(categoryName);
    context.push('${RoutePaths.product}?categoryName=${Uri.encodeComponent(categoryName)}');
  }

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(selectedStoreTabProvider);
    final section = bannerSectionForStore(store);
    final categoriesAsync = ref.watch(categoriesProvider);
    final meta = ref.watch(sectionsMetaProvider).value?[section];

    final sectionName = meta?['sectionName']?.toString().trim() ?? '';
    final badge = meta == null
        ? 'Categories'
        : ((meta['badge']?.toString().trim().isNotEmpty ?? false) ? meta['badge'].toString() : sectionName);
    final title = meta == null ? 'All Categories' : '$sectionName Categories';
    final subtitle = meta == null
        ? 'Browse products by category'
        : ((meta['description']?.toString().trim().isNotEmpty ?? false)
            ? meta['description'].toString()
            : 'Browse all curated product categories');
    final badgeColor = _hex(meta?['color']?.toString()) ?? const Color(0xFF0C831F);

    return ColoredBox(
      color: Colors.white,
      child: Column(
        children: [
          const StorefrontHeader(),
          Expanded(
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: RefreshIndicator(
                onRefresh: _refresh,
                color: const Color(0xFF0C831F),
                child: CustomScrollView(
                  controller: _scrollController,
                  physics: AppScrollConfig.listPhysics,
                  slivers: [
                    SliverToBoxAdapter(
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFFF8FAFC), Colors.white, Colors.white],
                          ),
                          border: Border(bottom: BorderSide(color: kWebBorder)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              badge.toUpperCase(),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.2,
                                color: badgeColor,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              title,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF0F172A),
                                height: 1.33,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              subtitle,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    ...categoriesAsync.when(
                      loading: () => [_message('Loading categories…')],
                      error: (_, _) => [_message('No categories yet. Add them in Product Management.')],
                      data: (categories) => categories.isEmpty
                          ? [_message('No categories yet. Add them in Product Management.')]
                          : [
                              SliverPadding(
                                padding: const EdgeInsets.all(16),
                                sliver: SliverGrid(
                                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 3,
                                    mainAxisSpacing: 10,
                                    crossAxisSpacing: 10,
                                  ),
                                  delegate: SliverChildBuilderDelegate(
                                    (context, i) => WebCategoryCard(
                                      category: categories[i],
                                      onTap: () => _onCategoryTapped(categories[i].categoryName),
                                    ),
                                    childCount: categories.length,
                                  ),
                                ),
                              ),
                            ],
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 80)),
                    SliverToBoxAdapter(
                      child: StorefrontFooter(bottomSpacer: MediaQuery.paddingOf(context).bottom),
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

  Widget _message(String text) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Text(
            text,
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: const Color(0xFF64748B)),
          ),
        ),
      );
}

/// Website `CategoryCard.jsx`: diagonal two-tone tile, uppercase name top-left,
/// image anchored bottom-right.
class WebCategoryCard extends StatelessWidget {
  const WebCategoryCard({super.key, required this.category, required this.onTap});

  final Category category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = _hex(category.bg) ?? const Color(0xFFE2F0D9);
    const cream = Color(0xFFF4F1EA);
    final fontSize = (MediaQuery.sizeOf(context).width * 0.032).clamp(12.0, 18.4);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x0D000000)),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [bg, bg, cream, cream],
            stops: const [0, 0.55, 0.55, 1],
          ),
          boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        clipBehavior: Clip.antiAlias,
        child: LayoutBuilder(
          builder: (context, c) => Stack(
            children: [
              if (category.categoryImage.isNotEmpty)
                Positioned(
                  right: 0,
                  bottom: 0,
                  width: c.maxWidth * 0.8,
                  height: c.maxHeight * 0.8,
                  child: AppNetworkImage(
                    imageUrl: category.categoryImage,
                    fit: BoxFit.contain,
                    alignment: Alignment.bottomRight,
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: SizedBox(
                  width: c.maxWidth * 0.7,
                  child: Text(
                    category.categoryName.toUpperCase(),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: fontSize.toDouble(),
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                      letterSpacing: -0.3,
                      color: const Color(0x99111827),
                    ),
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
