import 'policy_defaults.dart';

class InfoSection {
  const InfoSection({required this.title, required this.body, this.bullets});

  final String title;
  final String body;
  final List<String>? bullets;
}

class StaticPageContent {
  const StaticPageContent({
    required this.title,
    this.subtitle,
    this.sections = const [],
    this.body,
  });

  final String title;
  final String? subtitle;
  final List<InfoSection> sections;

  /// Policy-formatted text (`## Heading`, `- bullet`, `1. step`), used instead of [sections].
  final String? body;
}

class BlogPost {
  const BlogPost({
    required this.title,
    required this.date,
    required this.excerpt,
  });

  final String title;
  final String date;
  final String excerpt;
}

const aboutPage = StaticPageContent(
  title: 'About GreenGrocc',
  sections: [
    InfoSection(
      title: '',
      body:
          'GreenGrocc brings fresh groceries, daily essentials, and great prices to your door — fast delivery, honest pricing, and a smooth shopping experience.',
    ),
    InfoSection(
      title: 'Our Mission',
      body:
          'Make everyday grocery shopping simple, affordable, and reliable for every household — with quality products and support you can trust.',
    ),
    InfoSection(
      title: 'Who We Serve',
      body: '',
      bullets: [
        'Families & household shoppers',
        'Busy professionals who need quick delivery',
        'Anyone looking for fresh produce & daily essentials',
      ],
    ),
    InfoSection(
      title: 'What We Offer',
      body: '',
      bullets: [
        'Fresh fruits & vegetables',
        'Dairy, bakery & beverages',
        'Pantry staples & household needs',
        'Fast doorstep delivery',
        'Secure payments & easy returns',
        'Rewards & coupons on orders',
      ],
    ),
  ],
);

const privacyPolicyPage = StaticPageContent(
  title: 'Privacy Policy',
  subtitle: 'Last updated: $kPolicyDefaultsUpdated',
  body: kPrivacyPolicyBody,
);

const termsPage = StaticPageContent(
  title: 'Terms & Conditions',
  subtitle: 'Last updated: $kPolicyDefaultsUpdated',
  body: kTermsPolicyBody,
);

const refundPolicyPage = StaticPageContent(
  title: 'Return & Refund Policy',
  subtitle: 'Last updated: $kPolicyDefaultsUpdated',
  body: kRefundPolicyBody,
);

const shippingDetailsPage = StaticPageContent(
  title: 'Shipping & Delivery Policy',
  subtitle: 'Last updated: $kPolicyDefaultsUpdated',
  body: kShippingPolicyBody,
);

const blogPosts = <BlogPost>[
  BlogPost(
    title: 'How to Choose Fresh Fruits & Vegetables Daily',
    date: 'May 28, 2026',
    excerpt:
        'A practical guide for home cooks — ripeness indicators, storage tips, and choosing the freshest seasonal produce.',
  ),
  BlogPost(
    title: '5 Smart Ways to Save on Your Weekly Grocery Bill',
    date: 'May 15, 2026',
    excerpt:
        'Learn how meal planning, seasonal produce, and everyday value packs keep your household grocery budget healthy.',
  ),
  BlogPost(
    title: 'Farm to Doorstep: Understanding Produce Freshness',
    date: 'May 2, 2026',
    excerpt:
        'How GreenGrocc darkstores ensure harvest-fresh fruits and vegetables are inspected, packed, and delivered in minutes.',
  ),
  BlogPost(
    title: 'Top Seasonal Fruits & Veggies for Summer 2026',
    date: 'Apr 20, 2026',
    excerpt:
        'Stay healthy and hydrated with nutrient-rich seasonal produce available at your nearest GreenGrocc store.',
  ),
];
