import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/store_chrome.dart';
import '../../../routes/route_paths.dart';
import '../../../widgets/category/category_outline_icon.dart';
import '../home_providers.dart';

/// Website `shortCategoryLabel` — compact strip label for a category name.
String shortCategoryLabel(String name) {
  var label = name.trim();
  if (label.isEmpty || label.toLowerCase() == 'all') return 'All';
  label = label
      .replaceFirst(
        RegExp(
          r'^(super\s*mall|supermall|ready\s*2\s*cook|ready2cook|ready-to-cook|instant\s*order|instant|green\s*grocc|greengrocc)\s*[-:]?\s*',
          caseSensitive: false,
        ),
        '',
      )
      .trim();
  final key = label.toLowerCase();
  if (RegExp('packaged').hasMatch(key)) return 'Packaged';
  if (RegExp('grain|pulse').hasMatch(key)) return 'Grains';
  if (RegExp('snack|namkeen').hasMatch(key)) return 'Snacks';
  if (RegExp('beverage|drink').hasMatch(key)) return 'Drinks';
  if (RegExp('chopped').hasMatch(key)) return 'Chopped';
  if (RegExp(r'cut.*sliced|sliced').hasMatch(key)) return 'Sliced';
  if (RegExp('peeled').hasMatch(key)) return 'Peeled';
  if (RegExp(r'cleaned\s*bhaji|bhaji.*leafy|leafy').hasMatch(key)) return 'Bhaji';
  if (RegExp(r'veggie.*bhaji|bhaji\s*mix').hasMatch(key)) return 'Mix';
  if (RegExp(r'dry\s*fruit').hasMatch(key)) return 'Dry Fruits';
  if (RegExp('vegetable|veggies').hasMatch(key)) return 'Veggies';
  if (label.length <= 11) return label;
  final beforeJoin = label.split(RegExp(r'\s*[&/|]\s*')).first.trim();
  if (beforeJoin.length >= 3 && beforeJoin.length <= 11) return beforeJoin;
  final words = label.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.length >= 2) {
    final two = '${words[0]} ${words[1]}';
    if (two.length <= 11) return two;
    return words[0].length <= 11 ? words[0] : '${words[0].substring(0, 10)}…';
  }
  return '${label.substring(0, 10)}…';
}

class SelectedCategoryHeaderTabNotifier extends Notifier<String> {
  @override
  String build() => 'All';

  void setCategory(String name) => state = name;
}

final selectedCategoryHeaderTabProvider =
    NotifierProvider<SelectedCategoryHeaderTabNotifier, String>(
        SelectedCategoryHeaderTabNotifier.new);

class HomeHeaderCategoryStrip extends ConsumerWidget {
  final bool isLightBg;

  /// 1 = icons shown (expanded header), 0 = icons hidden (sticky header).
  final double iconProgress;

  static const double expandedHeight = 50;
  static const double collapsedHeight = 30;

  const HomeHeaderCategoryStrip({
    super.key,
    this.isLightBg = false,
    this.iconProgress = 1,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final currentStore = ref.watch(selectedStoreTabProvider);
    final selectedCategory = ref.watch(selectedCategoryHeaderTabProvider);

    final categoryList = categoriesAsync.maybeWhen(
      data: (cats) {
        final names = [
          'All',
          ...cats
              .map((c) => c.categoryName)
              .where((n) => n.toLowerCase() != 'most purchase'),
        ];
        final uniqueNames = <String>[];
        for (final name in names) {
          if (!uniqueNames.any((n) => n.toLowerCase() == name.toLowerCase())) {
            uniqueNames.add(name);
          }
        }
        return uniqueNames;
      },
      orElse: () => const ['All'],
    );

    final indicator = StoreChrome.forStore(currentStore).stripIndicator;
    final t = iconProgress.clamp(0.0, 1.0);
    final iconSpace = 20.0 * t;
    final height = collapsedHeight + (expandedHeight - collapsedHeight) * t;

    return Container(
      height: height,
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x1A064E3B))),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        itemCount: categoryList.length,
        separatorBuilder: (_, _) => const SizedBox(width: 4),
        itemBuilder: (context, index) {
          final catName = categoryList[index];
          final isSelected = selectedCategory == catName;
          final fg = isSelected ? const Color(0xFF022C22) : const Color(0xA6064E3B);

          return GestureDetector(
            onTap: () {
              ref
                  .read(selectedCategoryHeaderTabProvider.notifier)
                  .setCategory(catName);

              final lower = catName.toLowerCase().trim();

              if (lower == 'all') {
                context.go(RoutePaths.home);
              } else if (lower.contains('preorder') ||
                  lower.contains('pre-order') ||
                  lower.contains('pre order')) {
                ref.read(selectedStoreTabProvider.notifier).setStore('main');
                context.go(RoutePaths.home);
              } else {
                context.go(
                  '${RoutePaths.product}?categoryName=${Uri.encodeComponent(catName)}',
                );
              }
            },
            behavior: HitTestBehavior.opaque,
            child: SizedBox(
              width: 54.4,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    SizedBox(
                      height: iconSpace,
                      child: t <= 0.05
                          ? null
                          : Opacity(
                              opacity: t,
                              child: catName.toLowerCase() == 'all' && isSelected
                                  ? Icon(Icons.shopping_basket, size: 18, color: fg)
                                  : CategoryOutlineIcon(
                                      name: catName,
                                      index: index,
                                      size: 18,
                                      color: fg,
                                    ),
                            ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      shortCategoryLabel(catName),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                        color: fg,
                      ),
                    ),
                    const SizedBox(height: 4),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      height: 2.5,
                      width: 28,
                      decoration: BoxDecoration(
                        color: isSelected ? indicator : Colors.transparent,
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                    const SizedBox(height: 2),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
