import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme/store_chrome.dart';
import '../../../routes/route_paths.dart';
import '../home_providers.dart';

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

  IconData _getCategoryIcon(String name) {
    final lower = name.toLowerCase().trim();

    if (lower == 'all') return Icons.grid_view_rounded;
    if (lower.contains('preorder') ||
        lower.contains('pre-order') ||
        lower.contains('pre order')) {
      return Icons.calendar_today_rounded;
    }

    // Oils, Ghee, Refined, Mustard
    if (lower.contains('oil') ||
        lower.contains('ghee') ||
        lower.contains('mustard') ||
        lower.contains('refined')) {
      return Icons.opacity_rounded;
    }

    // Grocery, Atta, Flour, Rice, Dal, Pulses, Staples, Grains
    if (lower.contains('atta') ||
        lower.contains('flour') ||
        lower.contains('rice') ||
        lower.contains('dal') ||
        lower.contains('pulse') ||
        lower.contains('grain') ||
        lower.contains('grocery') ||
        lower.contains('staple')) {
      return Icons.rice_bowl_rounded;
    }

    // Spices, Masala, Chilli, Turmeric, Salt, Sugar
    if (lower.contains('spice') ||
        lower.contains('masala') ||
        lower.contains('chilli') ||
        lower.contains('turmeric') ||
        lower.contains('salt') ||
        lower.contains('sugar')) {
      return Icons.grain_rounded;
    }

    // Beverages, Drinks, Juice, Tea, Coffee, Soda, Water, Cold Drink
    if (lower.contains('beverage') ||
        lower.contains('drink') ||
        lower.contains('tea') ||
        lower.contains('coffee') ||
        lower.contains('juice') ||
        lower.contains('soda') ||
        lower.contains('water') ||
        lower.contains('cold drink')) {
      return Icons.local_drink_rounded;
    }

    // Bakery, Bread, Cakes, Cookies, Biscuits, Buns
    if (lower.contains('bakery') ||
        lower.contains('bread') ||
        lower.contains('cake') ||
        lower.contains('biscuit') ||
        lower.contains('cookie') ||
        lower.contains('toast') ||
        lower.contains('bun')) {
      return Icons.bakery_dining_rounded;
    }

    // Dairy, Milk, Paneer, Curd, Butter, Cheese, Dahi
    if (lower.contains('dairy') ||
        lower.contains('milk') ||
        lower.contains('paneer') ||
        lower.contains('curd') ||
        lower.contains('butter') ||
        lower.contains('cheese') ||
        lower.contains('dahi') ||
        lower.contains('cream')) {
      return Icons.water_drop_rounded;
    }

    // Dry Fruits, Nuts, Almond, Kaju, Badam, Raisins, Seeds
    if (lower.contains('dry fruit') ||
        lower.contains('nut') ||
        lower.contains('almond') ||
        lower.contains('cashew') ||
        lower.contains('kaju') ||
        lower.contains('badam') ||
        lower.contains('raisin') ||
        lower.contains('pista') ||
        lower.contains('walnut')) {
      return Icons.scatter_plot_rounded;
    }

    // Fruits, Apple, Mango, Banana, Orange
    if (lower.contains('fruit') ||
        lower.contains('apple') ||
        lower.contains('mango') ||
        lower.contains('banana') ||
        lower.contains('orange')) {
      return Icons.apple_rounded;
    }

    // Vegetables, Sabzi, Potato, Onion, Tomato
    if (lower.contains('veg') ||
        lower.contains('sabzi') ||
        lower.contains('potato') ||
        lower.contains('onion') ||
        lower.contains('tomato')) {
      return Icons.grass_rounded;
    }

    // Meat, Chicken, Fish, Eggs, Seafood, Mutton
    if (lower.contains('meat') ||
        lower.contains('chicken') ||
        lower.contains('fish') ||
        lower.contains('egg') ||
        lower.contains('seafood') ||
        lower.contains('mutton')) {
      return Icons.kebab_dining_rounded;
    }

    // Snacks, Chips, Namkeen, Sweets, Chocolates, Ice Cream
    if (lower.contains('snack') ||
        lower.contains('munchie') ||
        lower.contains('chip') ||
        lower.contains('sweet') ||
        lower.contains('chocolat') ||
        lower.contains('namkeen') ||
        lower.contains('candy') ||
        lower.contains('ice cream')) {
      return Icons.cookie_rounded;
    }

    // Ready to Cook, Instant Food, Noodles, Pasta, Sauce, Soup, Maggi
    if (lower.contains('ready') ||
        lower.contains('instant') ||
        lower.contains('noodle') ||
        lower.contains('pasta') ||
        lower.contains('sauce') ||
        lower.contains('soup') ||
        lower.contains('maggi') ||
        lower.contains('meal')) {
      return Icons.ramen_dining_rounded;
    }

    // Cleaning, Household, Detergent, Soap, Dish, Wash, Home Care
    if (lower.contains('clean') ||
        lower.contains('house') ||
        lower.contains('detergent') ||
        lower.contains('soap') ||
        lower.contains('dish') ||
        lower.contains('wash') ||
        lower.contains('home care')) {
      return Icons.cleaning_services_rounded;
    }

    // Personal Care, Beauty, Hygiene, Skincare, Haircare, Shampoo
    if (lower.contains('personal') ||
        lower.contains('care') ||
        lower.contains('beauty') ||
        lower.contains('skin') ||
        lower.contains('hair') ||
        lower.contains('shampoo') ||
        lower.contains('face') ||
        lower.contains('hygiene') ||
        lower.contains('bath')) {
      return Icons.sanitizer_rounded;
    }

    // Baby Care, Diapers, Infant
    if (lower.contains('baby') ||
        lower.contains('diaper') ||
        lower.contains('infant') ||
        lower.contains('kid')) {
      return Icons.child_friendly_rounded;
    }

    // Pet Care
    if (lower.contains('pet') || lower.contains('dog') || lower.contains('cat')) {
      return Icons.pets_rounded;
    }

    // Electronics & Appliances
    if (lower.contains('electronic') ||
        lower.contains('appliance') ||
        lower.contains('gadget') ||
        lower.contains('mobile') ||
        lower.contains('tech')) {
      return Icons.devices_other_rounded;
    }

    return Icons.grid_view_rounded;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final currentStore = ref.watch(selectedStoreTabProvider);
    final selectedCategory = ref.watch(selectedCategoryHeaderTabProvider);

    final categoryList = categoriesAsync.maybeWhen(
      data: (cats) {
        final names = ['All', ...cats.map((c) => c.categoryName)];
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
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        itemCount: categoryList.length,
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
            child: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 54),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    SizedBox(
                      height: iconSpace,
                      child: t <= 0.05
                          ? null
                          : Opacity(
                              opacity: t,
                              child: Icon(_getCategoryIcon(catName), size: 18, color: fg),
                            ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      catName,
                      maxLines: 1,
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
