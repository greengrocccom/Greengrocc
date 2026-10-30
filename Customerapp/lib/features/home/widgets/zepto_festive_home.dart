import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../config/theme.dart';
import '../../../models/category.dart';
import '../../../routes/route_paths.dart';
import '../../../widgets/category/category_grid_tile.dart';
import '../../../widgets/common/app_network_image.dart';
import '../home_providers.dart';

const _cream = Color(0xFFFFF6E0);
const _pink = Color(0xFFE11D48);
const _orange = Color(0xFFEA580C);

class _HeroTile {
  const _HeroTile({
    required this.title,
    required this.imageUrl,
    required this.categoryQuery,
    this.tall = false,
  });

  final String title;
  final String imageUrl;
  final String categoryQuery;
  final bool tall;
}

const _heroTiles = <_HeroTile>[
  _HeroTile(
    title: 'Daily Veggies',
    imageUrl:
        'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&h=500&q=80',
    categoryQuery: 'Vegetables',
    tall: true,
  ),
  _HeroTile(
    title: 'Fresh Fruits',
    imageUrl:
        'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=400&h=400&q=80',
    categoryQuery: 'Fruits',
  ),
  _HeroTile(
    title: 'Dairy & Eggs',
    imageUrl:
        'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&h=400&q=80',
    categoryQuery: 'Dairy',
  ),
  _HeroTile(
    title: 'Snacks & More',
    imageUrl:
        'https://images.unsplash.com/photo-1621939514649-212f69d60b12?auto=format&fit=crop&w=400&h=400&q=80',
    categoryQuery: 'Snacks',
  ),
  _HeroTile(
    title: 'Get Festive Ready',
    imageUrl:
        'https://images.unsplash.com/photo-1603228254111-d8c5c0b1f8b8?auto=format&fit=crop&w=400&h=400&q=80',
    categoryQuery: 'Festive',
  ),
];

/// Cream festive hero section with warm ambient tones.
class ZeptoFestiveHeroSection extends StatelessWidget {
  const ZeptoFestiveHeroSection({super.key});

  void _openCategory(BuildContext context, String name) {
    final q = name.trim();
    if (q.isEmpty) {
      context.go(RoutePaths.categories);
      return;
    }
    context.push('${RoutePaths.product}?categoryName=${Uri.encodeComponent(q)}');
  }

  @override
  Widget build(BuildContext context) {
    final tall = _heroTiles.first;
    final small = _heroTiles.skip(1).toList();

    return ColoredBox(
      color: _cream,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
        child: Column(
          children: [
            Text(
              '🌸 Celebrate Freshness 🌸',
              textAlign: TextAlign.center,
              style: GoogleFonts.playfairDisplay(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: _pink,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Farm-fresh groceries · Fast delivery',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF6B7280),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 268,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    flex: 5,
                    child: _FestiveCard(
                      title: tall.title,
                      imageUrl: tall.imageUrl,
                      onTap: () => _openCategory(context, tall.categoryQuery),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 6,
                    child: Column(
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Expanded(
                                child: _FestiveCard(
                                  title: small[0].title,
                                  imageUrl: small[0].imageUrl,
                                  compact: true,
                                  onTap: () =>
                                      _openCategory(context, small[0].categoryQuery),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _FestiveCard(
                                  title: small[1].title,
                                  imageUrl: small[1].imageUrl,
                                  compact: true,
                                  onTap: () =>
                                      _openCategory(context, small[1].categoryQuery),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: Row(
                            children: [
                              Expanded(
                                child: _FestiveCard(
                                  title: small[2].title,
                                  imageUrl: small[2].imageUrl,
                                  compact: true,
                                  onTap: () =>
                                      _openCategory(context, small[2].categoryQuery),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _FestiveCard(
                                  title: small[3].title,
                                  imageUrl: small[3].imageUrl,
                                  compact: true,
                                  onTap: () =>
                                      _openCategory(context, small[3].categoryQuery),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Powered by local farms · Co-powered by GreenGrocc',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF9A3412),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FestiveCard extends StatelessWidget {
  const _FestiveCard({
    required this.title,
    required this.imageUrl,
    required this.onTap,
    this.compact = false,
  });

  final String title;
  final String imageUrl;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.fromLTRB(10, compact ? 8 : 12, 10, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: compact ? 12 : 15,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF111827),
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 6),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: AppNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    width: double.infinity,
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

/// Horizontal "Festive Top Picks!" category chips.
class FestiveTopPicksSection extends ConsumerStatefulWidget {
  const FestiveTopPicksSection({super.key});

  @override
  ConsumerState<FestiveTopPicksSection> createState() =>
      _FestiveTopPicksSectionState();
}

class _FestiveTopPicksSectionState extends ConsumerState<FestiveTopPicksSection> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(categoriesProvider);

    return ColoredBox(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 10, 0, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                '🌸 Top Picks! 🌸',
                style: GoogleFonts.playfairDisplay(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _pink,
                ),
              ),
            ),
            const SizedBox(height: 12),
            categoriesAsync.when(
              loading: () => const SizedBox(
                height: 96,
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              ),
              error: (_, _) => const SizedBox.shrink(),
              data: (cats) {
                final list = filterShopCategories(cats);
                  final picks = <Category>[
                  Category(
                    id: 'trending',
                    categoryName: 'Trending',
                    categoryImage: '',
                  ),
                  ...list.take(10),
                ];
                if (picks.length < 2) return const SizedBox.shrink();

                return SizedBox(
                  height: 104,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    itemCount: picks.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      final c = picks[index];
                      final selected = index == _selected;
                      return GestureDetector(
                        onTap: () {
                          setState(() => _selected = index);
                          if (index == 0) {
                            context.push(RoutePaths.product);
                            return;
                          }
                          context.push(
                            '${RoutePaths.product}?categoryName=${Uri.encodeComponent(c.categoryName)}',
                          );
                        },
                        child: SizedBox(
                          width: 72,
                          child: Column(
                            children: [
                              Container(
                                width: 64,
                                height: 64,
                                decoration: BoxDecoration(
                                  color: selected
                                      ? const Color(0xFFFFEDD5)
                                      : const Color(0xFFF3F4F6),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: selected
                                        ? _orange
                                        : const Color(0xFFE5E7EB),
                                    width: selected ? 2 : 1,
                                  ),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: c.categoryImage.trim().isEmpty
                                    ? Icon(
                                        Icons.local_fire_department_rounded,
                                        color: selected
                                            ? _orange
                                            : AppColors.primary,
                                      )
                                    : AppNetworkImage(
                                        imageUrl: c.categoryImage,
                                        fit: BoxFit.cover,
                                      ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                c.categoryName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: selected
                                      ? _orange
                                      : const Color(0xFF374151),
                                ),
                              ),
                              const SizedBox(height: 4),
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 180),
                                height: 3,
                                width: selected ? 28 : 0,
                                decoration: BoxDecoration(
                                  color: _orange,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
