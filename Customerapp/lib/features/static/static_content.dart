import '../../config/contact.dart';

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
    required this.sections,
  });

  final String title;
  final String? subtitle;
  final List<InfoSection> sections;
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
  subtitle: 'Last updated: June 5, 2026',
  sections: [
    InfoSection(
      title: 'Information We Collect',
      body:
          'When you register, place an order, or contact us, we may collect your name, email, phone number, address details, and order-related information necessary to process your deliveries.',
    ),
    InfoSection(
      title: 'How We Use Your Information',
      body:
          'We use your data to process orders, provide customer support, improve our services, and share relevant updates about fresh deals and seasonal arrivals if you subscribe to our updates.',
    ),
    InfoSection(
      title: 'Data Security',
      body:
          'We implement reasonable security measures to protect your personal information. Passwords are encrypted and access to customer data is restricted to authorized personnel only.',
    ),
    InfoSection(
      title: 'Sharing of Information',
      body:
          'We do not sell your personal information. We may share data with trusted service providers (such as payment processors and delivery partners) only as needed to fulfill your orders.',
    ),
    InfoSection(
      title: 'Contact Us',
      body:
          'For privacy-related questions, email us at ${ContactConfig.contactEmail} or call ${ContactConfig.contactPhoneDisplay}.',
    ),
  ],
);

const termsPage = StaticPageContent(
  title: 'Terms & Conditions',
  subtitle: 'Last updated: June 5, 2026',
  sections: [
    InfoSection(
      title: 'General',
      body:
          'By using GreenGrocc, you agree to these terms. Our platform is for customers ordering groceries and daily essentials for personal or household use.',
    ),
    InfoSection(
      title: 'Orders & Product Availability',
      body:
          'All orders are subject to stock availability and confirmation. Fresh produce weights and counts may vary slightly within standard trade margins.',
    ),
    InfoSection(
      title: 'Payment & Invoicing',
      body:
          'Payment terms will be communicated at the time of order confirmation. Digital invoices are provided for all purchases.',
    ),
    InfoSection(
      title: 'Delivery',
      body:
          'We deliver through our dedicated dark stores and delivery partners. Delivery timelines vary by location. Risk of loss passes to the buyer upon successful delivery.',
    ),
    InfoSection(
      title: 'Returns & Refunds',
      body:
          'Return eligibility depends on product category and freshness standards. Contact support for return requests within the applicable window shown on your order page.',
    ),
    InfoSection(
      title: 'Contact',
      body:
          'Questions about these terms? Email ${ContactConfig.contactEmail} or call ${ContactConfig.contactPhoneDisplay}.',
    ),
  ],
);

const shippingDetailsPage = StaticPageContent(
  title: 'Shipping Details',
  subtitle: 'Last updated: June 10, 2026',
  sections: [
    InfoSection(
      title: 'Delivery Coverage',
      body:
          'GreenGrocc delivers fresh groceries and essentials fast through our network of local dark stores. We deliver to serviceable pin codes within our store delivery radius.',
    ),
    InfoSection(
      title: 'Fast Delivery',
      body:
          'Instant and ready-to-cook orders are packed and dispatched in minutes. Pre-orders are delivered in your chosen delivery time slot.',
    ),
    InfoSection(
      title: 'Delivery Charges',
      body:
          'Standard delivery charges apply on small orders. Orders meeting the free delivery threshold qualify for free doorstep delivery.',
    ),
    InfoSection(
      title: 'Estimated Delivery',
      body: '',
      bullets: [
        'Instant orders: Delivered in minutes from your local dark store',
        'Pre-orders: Delivered in your selected scheduled slot',
        'Special festive slots available during peak holiday seasons',
      ],
    ),
    InfoSection(
      title: 'Cash on Delivery (COD)',
      body:
          'COD is available on eligible orders. Cash is collected at your doorstep upon delivery. Please ensure exact change when possible.',
    ),
    InfoSection(
      title: 'Contact for Shipping Help',
      body:
          'For delivery queries, email ${ContactConfig.contactEmail} or call ${ContactConfig.contactPhoneDisplay}. Our store hub is at ${ContactConfig.contactAddress}.',
    ),
  ],
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
