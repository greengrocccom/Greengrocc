import 'package:flutter/material.dart';

import '../../config/theme.dart';
import '../../models/category.dart';
import '../common/app_network_image.dart';
import 'category_grid_tile.dart';

/// Category title + subcategory pills — frontend `CategoryHeaderSection`.
class CategoryHeaderSection extends StatelessWidget {
  const CategoryHeaderSection({
    super.key,
    required this.category,
    required this.categoryName,
    required this.subcategories,
    required this.selectedSubcategory,
    required this.onSubcategorySelected,
  });

  final Category? category;
  final String categoryName;
  final List<String> subcategories;
  final String? selectedSubcategory;
  final ValueChanged<String?> onSubcategorySelected;

  @override
  Widget build(BuildContext context) {
    final imageUrl = category != null ? resolveCategoryImageUrl(category!) : null;
    final subtitle = subcategories.isNotEmpty
        ? subcategories.join(', ')
        : 'Browse our $categoryName collection.';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: (imageUrl != null && imageUrl.trim().isNotEmpty)
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: AppNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.contain,
                          cacheWidth: 96,
                          cacheHeight: 96,
                          errorIcon: Icons.category_outlined,
                        ),
                      )
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: const AppImagePlaceholder(fit: BoxFit.contain),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      categoryName,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (subcategories.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text(
              'Filter by Subcategory:',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 32,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: subcategories.length + 1,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  if (index == 0) {
                    final isActive = selectedSubcategory == null ||
                        selectedSubcategory!.isEmpty;
                    return _SubcategoryChip(
                      label: 'All',
                      isActive: isActive,
                      onTap: () => onSubcategorySelected(null),
                    );
                  }

                  final sub = subcategories[index - 1];
                  final isActive = selectedSubcategory == sub;
                  return _SubcategoryChip(
                    label: sub,
                    isActive: isActive,
                    onTap: () => onSubcategorySelected(sub),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SubcategoryChip extends StatelessWidget {
  const _SubcategoryChip({
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive
              ? AppColors.primary
              : AppColors.mobileSurface,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: isActive ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}
