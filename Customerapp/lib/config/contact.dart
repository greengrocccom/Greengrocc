/// Social & contact links — mirrors frontend `config/contact.js`.
class SocialLink {
  const SocialLink({
    required this.id,
    required this.label,
    required this.description,
    required this.href,
    required this.platform,
  });

  final String id;
  final String label;
  final String description;
  final String href;
  final String platform;
}

abstract final class ContactConfig {
  static const contactEmail = 'greengrocc@gmail.com';

  static const contactPhoneRaw = '7400222233';
  static const contactPhoneDisplay = '+91 74002 22233';
  static const contactPhoneTel = 'tel:+917400222233';

  static const contactLocation = 'Mumbai';

  static const contactAddress = 'Mumbai Central';

  static const contactWhatsAppUrl =
      'https://wa.me/917400222233?text=Hi%2C%20I%20want%20to%20order%20from%20GreenGrocc.';

  static const supportWhatsAppUrl =
      'https://wa.me/917400222233?text=Hi%2C%20I%20need%20support%20with%20my%20order.';

  static const whatsAppGroupUrl =
      'https://chat.whatsapp.com/KEjIzY8mRbn8vR3LYBxnP8';

  static const socialLinks = <SocialLink>[
    SocialLink(
      id: 'whatsapp-community',
      label: 'WhatsApp Community',
      description: 'Join our community group',
      href: 'https://chat.whatsapp.com/KEjIzY8mRbn8vR3LYBxnP8',
      platform: 'whatsapp',
    ),
    SocialLink(
      id: 'whatsapp-channel',
      label: 'WhatsApp Channel',
      description: 'Follow for latest updates',
      href: 'https://whatsapp.com/channel/0029VbD3QHm8KMqo7ZP42U2a',
      platform: 'whatsapp',
    ),
    SocialLink(
      id: 'whatsapp-catalog',
      label: 'WhatsApp Catalog',
      description: 'Browse our product catalog',
      href: 'https://wa.me/c/917400222233',
      platform: 'whatsapp',
    ),
    SocialLink(
      id: 'instagram',
      label: 'Instagram',
      description: '@greengrocc.in',
      href:
          'https://www.instagram.com/greengrocc.in?igsh=YjlwcjZzamdpYXdp&utm_source=qr',
      platform: 'instagram',
    ),
    SocialLink(
      id: 'facebook',
      label: 'Facebook',
      description: 'Like & follow our page',
      href: 'https://www.facebook.com/share/17vXtbcF4D/?mibextid=wwXIfr',
      platform: 'facebook',
    ),
  ];
}
