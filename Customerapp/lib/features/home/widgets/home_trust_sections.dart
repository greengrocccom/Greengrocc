import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

TextStyle _deva(double size, FontWeight weight, Color color, {double? height}) =>
    GoogleFonts.notoSansDevanagari(fontSize: size, fontWeight: weight, color: color, height: height);

TextStyle _jakarta(double size, FontWeight weight, Color color, {double? height}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

/// Website FarmerTestimonials (mobile horizontal cards).
class FarmerTestimonials extends StatelessWidget {
  const FarmerTestimonials({super.key});

  static const _items = [
    (
      name: 'Ramesh Patil',
      location: 'Nashik, Maharashtra',
      quote:
          'GreenGrocc has given me a better market for my produce. I now get fair prices and regular orders.',
      image: 'assets/website/testimonial_ramesh_patil.png',
      produce: 'Spinach',
      badge: '🌿',
    ),
    (
      name: 'Sangita Jadhav',
      location: 'Ahmednagar, Maharashtra',
      quote:
          'It is very easy to list my products and manage orders. GreenGrocc has helped me reach more customers.',
      image: 'assets/website/testimonial_sangita_jadhav.png',
      produce: 'Tomato',
      badge: '🍅',
    ),
    (
      name: 'Vijay Shinde',
      location: 'Pune, Maharashtra',
      quote:
          'The collection and payment process is smooth. I can focus on farming while GreenGrocc takes care of the rest.',
      image: 'assets/website/testimonial_vijay_shinde.png',
      produce: 'Bottle Gourd',
      badge: '🍐',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF4FAF5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDDEADB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.eco_rounded, size: 30, color: Color(0xFF15803D)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: 'Farmer ',
                              style: _jakarta(20, FontWeight.w800, const Color(0xFF0D3B1E)),
                            ),
                            TextSpan(
                              text: 'Testimonials',
                              style: _jakarta(20, FontWeight.w800, const Color(0xFF15803D)),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        'Real stories from our farmers who grow with us',
                        style: _jakarta(12, FontWeight.w500, const Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 170,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) {
                final t = _items[i];
                return Container(
                  width: 290,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2EFE5)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: SizedBox(
                          width: 105,
                          child: Image.asset(t.image, fit: BoxFit.cover),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 24,
                              height: 24,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEEF8F1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Icon(Icons.format_quote_rounded,
                                  size: 16, color: Color(0xFF0A6C38)),
                            ),
                            const SizedBox(height: 6),
                            Expanded(
                              child: Text(
                                '“${t.quote}”',
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                                style: _jakarta(11.5, FontWeight.w500, const Color(0xFF374151),
                                    height: 1.35),
                              ),
                            ),
                            const Divider(height: 10, color: Color(0xFFF3F4F6)),
                            Row(
                              children: [
                                Container(
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFECFDF5),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: const Color(0xFFA7F3D0)),
                                  ),
                                  child: const Icon(Icons.person_outline_rounded,
                                      size: 14, color: Color(0xFF0A6C38)),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(t.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: _jakarta(
                                              12, FontWeight.w700, const Color(0xFF111827))),
                                      Text(t.location,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: _jakarta(
                                              10, FontWeight.w400, const Color(0xFF6B7280))),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0F8F2),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: const Color(0x80A7F3D0)),
                              ),
                              child: Text(
                                '${t.badge} ${t.produce}',
                                style: _jakarta(10.5, FontWeight.w600, const Color(0xFF0A6C38)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Website FarmerGrowthBanner (mobile layout).
class FarmerGrowthBanner extends StatelessWidget {
  const FarmerGrowthBanner({super.key});

  @override
  Widget build(BuildContext context) {
    const stats = [
      (icon: Icons.agriculture_rounded, value: '5000+', label: 'शेतकरी जोडलेले'),
      (icon: Icons.home_outlined, value: '200+', label: 'गावे'),
      (icon: Icons.verified_user_outlined, value: '10,000+', label: 'ग्राहक कुटुंबे'),
    ];
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: const LinearGradient(
          colors: [Color(0xFF033418), Color(0xFF064E29), Color(0xFF033418)],
        ),
        border: Border.all(color: const Color(0x99064E3B)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🌿', style: TextStyle(fontSize: 15)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  'शेतकऱ्यांसोबत वाढणारा भारत',
                  style: _deva(14, FontWeight.w800, Colors.white),
                ),
              ),
              const SizedBox(width: 6),
              const Text('🌿', style: TextStyle(fontSize: 15)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0x26FFFFFF))),
            ),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  for (var i = 0; i < stats.length; i++) ...[
                    if (i > 0) const VerticalDivider(width: 1, color: Color(0x33FFFFFF)),
                    Expanded(
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(stats[i].icon, size: 14, color: const Color(0xFFF3BA2F)),
                              const SizedBox(width: 4),
                              Text(stats[i].value,
                                  style: _jakarta(13, FontWeight.w900, Colors.white)),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(stats[i].label,
                              style: _deva(9.5, FontWeight.w600, const Color(0xFFFDE047))),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Website WhatMakesUsDifferent (mobile): feature grid + comparison card.
class WhatMakesUsDifferent extends StatelessWidget {
  const WhatMakesUsDifferent({super.key});

  static const _features = [
    (icon: Icons.agriculture_outlined, title: 'Direct from Farmers', sub: '(शेतकऱ्यांशी थेट)'),
    (icon: Icons.eco_rounded, title: '100% Fresh & Natural', sub: '(ताजे व नैसर्गिक)'),
    (icon: Icons.verified_user_outlined, title: 'Quality Assured', sub: '(गुणवत्ता तपासणी)'),
    (icon: Icons.science_outlined, title: 'Organic & Chemical Free', sub: '(सेंद्रिय उत्पादन)'),
    (icon: Icons.local_offer_outlined, title: 'Exclusive Offers', sub: '(विशेष सवलती)'),
    (icon: Icons.assignment_turned_in_outlined, title: 'Easy Ordering', sub: '(सोपे ऑर्डर)'),
    (icon: Icons.local_shipping_outlined, title: 'Fast Doorstep Delivery', sub: '(घरपोच सुविधा)'),
    (icon: Icons.headset_mic_outlined, title: '24/7 Support', sub: '(ग्राहक सहाय्य)'),
  ];

  static const _others = [
    'शेतकरी माहिती नाही',
    'सेंद्रिय गुणवत्तेची खात्री नाही',
    'ट्रेसेबिलिटी नाही',
    'लॅब टेस्ट नाही',
    'स्थानिक उत्पादनांना प्राधान्य नाही',
  ];

  static const _ours = [
    'प्रत्येक शेतकऱ्याची माहिती',
    '100% सेंद्रिय व नैसर्गिक उत्पादने',
    'एंड टू एंड ट्रेसेबिलिटी',
    'प्रमाणित लॅब टेस्ट रिपोर्ट',
    'स्थानिक शेतकऱ्यांना समर्थन',
    'ताजे व हंगामी उत्पादने',
  ];

  static const _dark = Color(0xFF0C4A28);
  static const _line = Color(0xFFE1EDE4);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('App मध्ये खास वैशिष्ट्ये', style: _deva(20, FontWeight.w900, _dark)),
          const SizedBox(height: 14),
          for (var row = 0; row < 4; row++)
            IntrinsicHeight(
              child: Row(
                children: [
                  for (var col = 0; col < 2; col++)
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
                        decoration: BoxDecoration(
                          border: Border(
                            right: col == 0 ? const BorderSide(color: _line) : BorderSide.none,
                            bottom: row < 3 ? const BorderSide(color: _line) : BorderSide.none,
                          ),
                        ),
                        child: Column(
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: const BoxDecoration(
                                color: Color(0xFFE6F5EA),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(_features[row * 2 + col].icon, size: 28, color: _dark),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              _features[row * 2 + col].title,
                              textAlign: TextAlign.center,
                              style: _jakarta(12, FontWeight.w900, const Color(0xFF113821)),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _features[row * 2 + col].sub,
                              textAlign: TextAlign.center,
                              style: _deva(11, FontWeight.w700, _dark),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 28),
          Text('ग्रीनग्रोक का वेगळं ?', style: _deva(20, FontWeight.w900, _dark)),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xE6E5E7EB)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  color: const Color(0xFFE4E9F0),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  alignment: Alignment.center,
                  child: Text('इतर प्लॅटफॉर्म',
                      style: _deva(13, FontWeight.w800, const Color(0xFF1F2937))),
                ),
                _PointList(points: _others, positive: false),
                const Divider(height: 1, color: Color(0xFFE5E7EB)),
                Container(
                  color: const Color(0xFF0C833D),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.eco_rounded, size: 16, color: Colors.white),
                      const SizedBox(width: 6),
                      Text(
                        'GREENGROCC',
                        style: _jakarta(12, FontWeight.w900, Colors.white)
                            .copyWith(letterSpacing: 1.2),
                      ),
                    ],
                  ),
                ),
                _PointList(points: _ours, positive: true),
                Container(
                  color: const Color(0xFF06381B),
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Row(
                      children: [
                        const Icon(Icons.eco_rounded, size: 14, color: Color(0xFF34D399)),
                        const SizedBox(width: 4),
                        Text('Healthy Food', style: _jakarta(10, FontWeight.w700, Colors.white)),
                        Text('  |  ', style: _jakarta(10, FontWeight.w700, Colors.white38)),
                        Text('👥 Happy Farmers',
                            style: _jakarta(10, FontWeight.w700, Colors.white)),
                        Text('  |  ', style: _jakarta(10, FontWeight.w700, Colors.white38)),
                        Text('🤍 Stronger Maharashtra',
                            style: _jakarta(10, FontWeight.w700, Colors.white)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PointList extends StatelessWidget {
  const _PointList({required this.points, required this.positive});

  final List<String> points;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          for (final p in points)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  Icon(
                    positive ? Icons.check_rounded : Icons.close_rounded,
                    size: 16,
                    color: positive ? const Color(0xFF0A803E) : const Color(0xFFEF4444),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(p, style: _deva(12, FontWeight.w700, const Color(0xFF1F2937))),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Website MaharashtraPrideBanner (mobile): farm photo hero + 6 pillar cards.
class MaharashtraPrideBanner extends StatelessWidget {
  const MaharashtraPrideBanner({super.key});

  static const _pillars = [
    (
      icon: Icons.agriculture_outlined,
      title: 'Farmer Direct',
      sub: '(दलालीशिवाय थेट)',
      detail: 'ताजे उत्पादन थेट शेतकऱ्यांकडून',
    ),
    (
      icon: Icons.spa_outlined,
      title: '100% Organic',
      sub: '(सेंद्रिय शेती)',
      detail: 'रसायनमुक्त आणि नैसर्गिक उत्पादन',
    ),
    (
      icon: Icons.qr_code_2_rounded,
      title: 'Full Traceability',
      sub: '(पूर्ण पारदर्शकता)',
      detail: 'शेतापासून तुमच्या घरापर्यंत',
    ),
    (
      icon: Icons.science_outlined,
      title: 'Lab Tested',
      sub: '(गुणवत्ता चाचणी)',
      detail: 'प्रत्येक उत्पादनाची प्रमाणित तपासणी',
    ),
    (
      icon: Icons.how_to_reg_outlined,
      title: 'Farmer Profile',
      sub: '(शेतकऱ्यांची ओळख)',
      detail: 'शेतकऱ्यांची माहिती, फोटो, शेती तपशील',
    ),
    (
      icon: Icons.favorite_border_rounded,
      title: 'Organic Lifestyle',
      sub: '(आरोग्यासाठी पर्याय)',
      detail: 'ताजे, पौष्टिक, रसायनमुक्त उत्पादने',
    ),
  ];

  Widget _pill(IconData icon, String text, Color bg, Color border, Color fg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: const Color(0xFF34D399)),
            const SizedBox(width: 5),
            Text(text, style: _jakarta(10.5, FontWeight.w800, fg)),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final white = Colors.white.withValues(alpha: 0.95);
    return ColoredBox(
      color: const Color(0xFFFCFDFD),
      child: Column(
        children: [
          SizedBox(
            height: 320,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset('assets/website/maharashtra_farm_sunrise.jpg', fit: BoxFit.cover),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x99000000), Color(0x73000000), Color(0xE6000000)],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 30),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _pill(Icons.spa_outlined, 'GREENGROCC', const Color(0x73000000),
                              const Color(0x6634D399), const Color(0xFF6EE7B7)),
                          _pill(Icons.location_on_outlined, 'Proudly Maharashtra Based',
                              const Color(0xBF022C22), const Color(0x8034D399),
                              const Color(0xFFA7F3D0)),
                        ],
                      ),
                      const Spacer(),
                      Text.rich(
                        TextSpan(
                          children: [
                            const TextSpan(text: 'माती, महाराष्ट्राचा\n'),
                            TextSpan(
                              text: 'अभिमान',
                              style: _deva(25, FontWeight.w900, const Color(0xFF38E275)),
                            ),
                          ],
                        ),
                        style: _deva(25, FontWeight.w900, Colors.white, height: 1.25),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'फक्त डिलिव्हरी नाही... ही आहे शेतकऱ्यांची, तुमच्या आरोग्याची आणि आपल्या भविष्यासाठी गुंतवणुकीची कहाणी!',
                        style: _deva(12, FontWeight.w500, white, height: 1.5),
                      ),
                      const SizedBox(height: 14),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Row(
                          children: [
                            const Icon(Icons.eco_outlined, size: 14, color: Color(0xFF34D399)),
                            const SizedBox(width: 4),
                            Text('स्वाभाविक शेती', style: _deva(11, FontWeight.w700, white)),
                            Text('  |  ', style: _deva(11, FontWeight.w700, Colors.white38)),
                            const Icon(Icons.verified_user_outlined,
                                size: 14, color: Color(0xFF34D399)),
                            const SizedBox(width: 4),
                            Text('सुरक्षित पोषणमूल्ये', style: _deva(11, FontWeight.w700, white)),
                            Text('  |  ', style: _deva(11, FontWeight.w700, Colors.white38)),
                            const Icon(Icons.spa_outlined, size: 14, color: Color(0xFF34D399)),
                            const SizedBox(width: 4),
                            Text('१००% शुद्धता', style: _deva(11, FontWeight.w700, white)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Transform.translate(
            offset: const Offset(0, -20),
            child: Container(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 20),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 25, offset: Offset(0, -8))],
              ),
              child: GridView.builder(
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  mainAxisExtent: 84,
                ),
                itemCount: _pillars.length,
                itemBuilder: (context, i) {
                  final p = _pillars[i];
                  return Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xB3D1FAE5)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCF4E4),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFD1FAE5)),
                          ),
                          child: Icon(p.icon, size: 22, color: const Color(0xFF065F46)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(p.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: _jakarta(12, FontWeight.w900, const Color(0xFF111827))),
                              Text(p.sub,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: _deva(10.5, FontWeight.w700, const Color(0xFF075E34))),
                              Text(p.detail,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: _deva(9.5, FontWeight.w500, const Color(0xFF6B7280),
                                      height: 1.25)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
