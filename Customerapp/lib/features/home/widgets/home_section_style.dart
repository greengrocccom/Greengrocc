import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../models/product.dart';
import '../../../widgets/common/app_network_image.dart';

/// Colour of a tinted home section: a soft top-to-bottom wash and the title ink.
class HomeSectionTint {
  const HomeSectionTint(this.top, this.bottom, this.ink);

  final Color top;
  final Color bottom;
  final Color ink;

  static const pink = HomeSectionTint(Color(0xFFFCE4EC), Color(0xFFFFF5F8), Color(0xFF7A1F45));
  static const blue = HomeSectionTint(Color(0xFFDCEFFD), Color(0xFFF3F9FF), Color(0xFF0B4A6F));
  static const mint = HomeSectionTint(Color(0xFFD9F7E3), Color(0xFFF2FCF5), Color(0xFF14532D));
  static const lavender = HomeSectionTint(Color(0xFFEAE4FD), Color(0xFFF7F4FF), Color(0xFF4C1D95));
  static const peach = HomeSectionTint(Color(0xFFFFE8D2), Color(0xFFFFF7EE), Color(0xFF7C2D12));

  /// Cycled through by rows that alternate (category rows on home).
  static const cycle = [pink, blue, mint, lavender, peach];
}

/// Emoji for a category row title, picked from its name.
String categoryEmoji(String name) {
  final n = name.toLowerCase();
  const map = <String, String>{
    'fruit': '🍎',
    'vegetable': '🥦',
    'veg': '🥦',
    'leaf': '🥬',
    'green': '🥬',
    'herb': '🌿',
    'dairy': '🥛',
    'milk': '🥛',
    'egg': '🥚',
    'bakery': '🍞',
    'bread': '🍞',
    'snack': '🍿',
    'beverage': '🥤',
    'drink': '🥤',
    'juice': '🧃',
    'meat': '🍗',
    'chicken': '🍗',
    'fish': '🐟',
    'sea': '🦐',
    'rice': '🍚',
    'atta': '🌾',
    'grain': '🌾',
    'dal': '🫘',
    'pulse': '🫘',
    'spice': '🌶️',
    'masala': '🌶️',
    'oil': '🫒',
    'dry fruit': '🥜',
    'nut': '🥜',
    'sweet': '🍬',
    'chocolate': '🍫',
    'flower': '🌸',
    'organic': '🌱',
    'exotic': '🥑',
    'cook': '🍳',
    'ready': '🍳',
    'frozen': '🧊',
    'clean': '🧼',
    'home': '🏠',
    'baby': '🍼',
    'pet': '🐾',
  };
  for (final entry in map.entries) {
    if (n.contains(entry.key)) return entry.value;
  }
  return '🛍️';
}

/// Scalloped top and bottom edges, like a torn ticket.
class WavyEdgeClipper extends CustomClipper<Path> {
  const WavyEdgeClipper({this.amplitude = 5, this.wavelength = 22});

  final double amplitude;
  final double wavelength;

  @override
  Path getClip(Size size) {
    final a = amplitude;
    final w = wavelength;
    final path = Path()..moveTo(0, a);
    for (double x = 0; x < size.width; x += w) {
      path
        ..quadraticBezierTo(x + w / 4, 0, x + w / 2, a)
        ..quadraticBezierTo(x + 3 * w / 4, 2 * a, x + w, a);
    }
    path.lineTo(size.width, size.height - a);
    for (double x = size.width; x > 0; x -= w) {
      path
        ..quadraticBezierTo(x - w / 4, size.height, x - w / 2, size.height - a)
        ..quadraticBezierTo(x - 3 * w / 4, size.height - 2 * a, x - w, size.height - a);
    }
    return path..close();
  }

  @override
  bool shouldReclip(WavyEdgeClipper oldClipper) =>
      oldClipper.amplitude != amplitude || oldClipper.wavelength != wavelength;
}

/// Big bold section title with its emoji.
class HomeSectionTitle extends StatelessWidget {
  const HomeSectionTitle({super.key, required this.title, required this.emoji, this.color});

  final String title;
  final String emoji;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Flexible(
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: color ?? const Color(0xFF0F172A),
              letterSpacing: -0.3,
              height: 1.15,
            ),
          ),
        ),
        if (emoji.isNotEmpty) ...[
          const SizedBox(width: 6),
          Text(emoji, style: const TextStyle(fontSize: 22, height: 1.1)),
        ],
      ],
    );
  }
}

/// White "See all products ›" pill with up to three overlapping product thumbnails.
class SeeAllProductsButton extends StatelessWidget {
  const SeeAllProductsButton({super.key, required this.products, required this.onTap});

  final List<Product> products;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final images = products
        .map((p) => p.primaryImage ?? '')
        .where((url) => url.trim().isNotEmpty)
        .take(3)
        .toList();
    const thumb = 26.0;
    const overlap = 10.0;

    return Center(
      child: Material(
        color: Colors.white,
        shape: const StadiumBorder(side: BorderSide(color: Color(0xFFE2E8F0))),
        child: InkWell(
          onTap: onTap,
          customBorder: const StadiumBorder(),
          child: Padding(
            padding: EdgeInsets.fromLTRB(images.isEmpty ? 18 : 8, 7, 12, 7),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (images.isNotEmpty) ...[
                  SizedBox(
                    width: thumb + (images.length - 1) * (thumb - overlap),
                    height: thumb,
                    child: Stack(
                      children: [
                        for (var i = 0; i < images.length; i++)
                          Positioned(
                            left: i * (thumb - overlap),
                            child: Container(
                              width: thumb,
                              height: thumb,
                              padding: const EdgeInsets.all(1.5),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 2)],
                              ),
                              child: ClipOval(
                                child: AppNetworkImage(
                                  imageUrl: images[i],
                                  fit: BoxFit.cover,
                                  cacheWidth: 64,
                                  errorIconSize: 12,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  'See all products',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1E293B),
                  ),
                ),
                const Icon(Icons.arrow_right_rounded, size: 20, color: Color(0xFF1E293B)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A home section: title + emoji, content, and a "See all products" button below.
/// With a [tint] it sits on a coloured wash with wavy top and bottom edges.
class HomeStyledSection extends StatelessWidget {
  const HomeStyledSection({
    super.key,
    required this.title,
    required this.emoji,
    required this.child,
    required this.products,
    required this.onViewAll,
    this.tint,
    this.contentPadding = const EdgeInsets.only(left: 12),
  });

  final String title;
  final String emoji;
  final Widget child;

  /// Products whose thumbnails decorate the "See all products" button.
  final List<Product> products;
  final VoidCallback onViewAll;
  final HomeSectionTint? tint;

  /// Padding around [child]; horizontal rows keep the right edge open so they scroll off-screen.
  final EdgeInsets contentPadding;

  @override
  Widget build(BuildContext context) {
    final tint = this.tint;
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          child: HomeSectionTitle(title: title, emoji: emoji, color: tint?.ink),
        ),
        Padding(padding: contentPadding, child: child),
        const SizedBox(height: 14),
        SeeAllProductsButton(products: products, onTap: onViewAll),
      ],
    );

    if (tint == null) {
      return Padding(padding: const EdgeInsets.fromLTRB(0, 14, 0, 14), child: body);
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: ClipPath(
        clipper: const WavyEdgeClipper(),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [tint.top, tint.bottom],
            ),
          ),
          child: Padding(padding: const EdgeInsets.fromLTRB(0, 20, 0, 22), child: body),
        ),
      ),
    );
  }
}
