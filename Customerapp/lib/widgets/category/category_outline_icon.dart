import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Outline category icons from the website's `CategoryIcon.jsx`.
class CategoryOutlineIcon extends StatelessWidget {
  const CategoryOutlineIcon({
    super.key,
    required this.name,
    this.index = 0,
    this.size = 24,
    this.color = Colors.black,
  });

  final String name;
  final int index;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final paths = _iconPaths(name, index);
    final svg = '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.6" '
        'stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">'
        '${paths.map((d) => '<path d="$d"/>').join()}</svg>';
    return SvgPicture.string(
      svg,
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );
  }

  static const _basket = [
    'M4 10h16l-1.2 9.2A2 2 0 0116.82 21H7.18a2 2 0 01-1.98-1.8L4 10z',
    'M8 10V7a4 4 0 018 0v3',
  ];
  static const _fruits = [
    'M12 22c4.5 0 7-2.8 7-7.2 0-3.6-2.2-6.3-4.8-7.5.6-1.2.7-2.3.4-3.3-.8.5-1.7.8-2.6.8S10.2 4.5 9.4 4c-.3 1-.2 2.1.4 3.3C7.2 8.5 5 11.2 5 14.8 5 19.2 7.5 22 12 22z',
    'M12 4.5c0-1 .4-1.9 1.1-2.5',
  ];
  static const _vegetables = [
    'M12 22c3.5 0 6-2.2 6-5.5 0-2.8-1.8-4.8-4-5.8 1.2-.9 2-2.3 2-3.9C16 4.5 14.2 3 12 3S8 4.5 8 6.8c0 1.6.8 3 2 3.9-2.2 1-4 3-4 5.8C6 19.8 8.5 22 12 22z',
    'M12 10.5V3',
  ];
  static const _organic = [
    'M5 19c6-1 10-5 12-12 0 0-5 1-8 4S5 19 5 19z',
    'M9 13c2 2 5 4 8 5',
  ];
  static const _dairy = [
    'M8 7h8l1 3v9a2 2 0 01-2 2H9a2 2 0 01-2-2V10l1-3z',
    'M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2',
    'M8 11h8',
  ];
  static const _carrot = [
    'M12 22c2.5-3.5 4-7.5 4-11H8c0 3.5 1.5 7.5 4 11z',
    'M10 5c.5 1.5 1.2 2.5 2 3 .8-.5 1.5-1.5 2-3',
    'M12 8V4M9.5 5.5 8 3M14.5 5.5 16 3',
  ];
  static const _grains = [
    'M12 3c-2 3-4 5-4 8a4 4 0 008 0c0-3-2-5-4-8z',
    'M8 14c-1.5 2-2 3.5-2 5a3 3 0 006 0c0-1.5-.5-3-2-5',
    'M16 14c-1.5 2-2 3.5-2 5a3 3 0 006 0c0-1.5-.5-3-2-5',
  ];
  static const _spices = [
    'M9 3h6v3H9z',
    'M8 6h8l1 3v10a2 2 0 01-2 2H9a2 2 0 01-2-2V9l1-3z',
    'M10 12h4M10 15h4',
  ];
  static const _beverage = [
    'M8 4h8l1 4H7l1-4z',
    'M7 8h10v10a2 2 0 01-2 2H9a2 2 0 01-2-2V8z',
    'M10 12h4',
  ];
  static const _bakery = [
    'M4 14c0-3 2.5-5 4.5-5 .8 0 1.5.2 2 .6.5-.4 1.2-.6 2-.6s1.5.2 2 .6c.5-.4 1.2-.6 2-.6C18.5 9 21 11 21 14c0 2-1 4-4 4H8c-3 0-4-2-4-4z',
    'M8 14h.01M12 14h.01M16 14h.01',
  ];
  static const _oil = [
    'M10 3h4v3l2 2v11a2 2 0 01-2 2h-4a2 2 0 01-2-2V8l2-2V3z',
    'M10 12h4',
  ];
  static const _knife = [
    'M4 20 14 6l4 4-6 10H4z',
    'M14 6c1.5-1.5 3.5-2 5-1.5.2 1.8-.8 3.5-2.5 4.5',
  ];

  static const _byKey = <String, List<String>>{
    'all': _basket,
    'fruits': _fruits,
    'fruit': _fruits,
    'vegetables': _vegetables,
    'vegetable': _vegetables,
    'veggies': _vegetables,
    'vegies': _vegetables,
    'organic': _organic,
    'dairy': _dairy,
    'milk': _dairy,
    'curd': _dairy,
    'carrots': _carrot,
    'carrot': _carrot,
    'grains': _grains,
    'grain': _grains,
    'pulses': _grains,
    'pulse': _grains,
    'rice': _grains,
    'spices': _spices,
    'spice': _spices,
    'masala': _spices,
    'oils': _oil,
    'oil': _oil,
    'beverages': _beverage,
    'beverage': _beverage,
    'drinks': _beverage,
    'drink': _beverage,
    'soda': _beverage,
    'bakery': _bakery,
    'bread': _bakery,
    'grocery': _basket,
    'household': _basket,
    'personal': _basket,
    'chopped': _knife,
    'sliced': _knife,
    'peeled': _knife,
    'cleaned': _knife,
    'bhaji': _vegetables,
    'leafy': _vegetables,
  };

  static final _rules = <(RegExp, List<String>)>[
    (RegExp('fruit'), _fruits),
    (RegExp('vegetable|veggie|vegie|bhaji|leafy|salad'), _vegetables),
    (RegExp('organic|farm'), _organic),
    (RegExp('dairy|milk|curd|paneer|butter|ghee'), _dairy),
    (RegExp('carrot'), _carrot),
    (RegExp('grain|pulse|rice|wheat|flour|atta'), _grains),
    (RegExp('spice|masala|chili|chilli|pepper'), _spices),
    (RegExp('oil|ghee'), _oil),
    (RegExp('beverage|drink|juice|soda|tea|coffee'), _beverage),
    (RegExp('bakery|bread|cake|biscuit'), _bakery),
    (RegExp('chop|slice|peel|clean|cut|ready'), _knife),
  ];

  static const _fallback = [_basket, _fruits, _vegetables, _organic, _dairy, _carrot];

  static List<String> _iconPaths(String name, int index) {
    final key = name.trim().toLowerCase();
    final direct = _byKey[key];
    if (direct != null) return direct;
    for (final token in key.split(RegExp(r'[\s&/_,-]+')).where((t) => t.isNotEmpty)) {
      final match = _byKey[token];
      if (match != null) return match;
    }
    for (final (pattern, paths) in _rules) {
      if (pattern.hasMatch(key)) return paths;
    }
    return _fallback[index % _fallback.length];
  }
}
