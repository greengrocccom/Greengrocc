import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../config/contact.dart';
import '../../../routes/route_paths.dart';
import 'home_trust_sections.dart';

const footerGreen = Color(0xFF006030);

/// Website `Footer.jsx` for every mobile page: Maharashtra banner, then the
/// green footer.
class StorefrontFooter extends StatelessWidget {
  const StorefrontFooter({super.key, this.bottomSpacer = 0});

  final double bottomSpacer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ColoredBox(
          color: Color(0xFFFCFDFD),
          child: Padding(
            padding: EdgeInsets.only(bottom: 24),
            child: MaharashtraPrideBanner(),
          ),
        ),
        const HomeFooter(),
        ColoredBox(color: footerGreen, child: SizedBox(height: bottomSpacer)),
      ],
    );
  }
}

/// Website mobile footer: farmer over a green dome, logo badge, MENU and
/// CONTACTS accordions, app badges, socials and the legal line.
class HomeFooter extends StatefulWidget {
  const HomeFooter({super.key});

  @override
  State<HomeFooter> createState() => _HomeFooterState();
}

class _HomeFooterState extends State<HomeFooter> {
  bool _menuOpen = true;
  bool _contactsOpen = true;

  static const _menu = <(String, String)>[
    ('Home', RoutePaths.home),
    ('About Us', RoutePaths.about),
    ('Contact Us', RoutePaths.contact),
    ('FAQs', RoutePaths.support),
    ('Why GreenGrocc?', RoutePaths.about),
  ];

  void _open(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

  void _go(String route) {
    if (route == RoutePaths.home) {
      context.go(route);
    } else {
      context.push(route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final white = GoogleFonts.plusJakartaSans(color: Colors.white);
    final legal = white.copyWith(fontSize: 11, color: Colors.white.withValues(alpha: 0.85));
    final divider = Colors.white.withValues(alpha: 0.2);

    Widget accordionHeader(String label, bool open, VoidCallback onTap) => InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: white.copyWith(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.75),
                  ),
                ),
                AnimatedRotation(
                  turns: open ? 0 : 0.5,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(Icons.keyboard_arrow_up_rounded, color: Colors.white, size: 24),
                ),
              ],
            ),
          ),
        );

    Widget contactRow(IconData icon, Widget child, {VoidCallback? onTap}) => GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                child: Icon(icon, color: footerGreen, size: 18),
              ),
              const SizedBox(width: 14),
              Expanded(child: child),
            ],
          ),
        );

    Widget socialIcon(IconData icon, String? url) => GestureDetector(
          onTap: url == null ? null : () => _open(url),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.6)),
            ),
            child: Icon(icon, color: Colors.white, size: 18),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned.fill(
              top: 40,
              child: CustomPaint(painter: _DomePainter()),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Image.asset(
                'assets/website/footer_farmer_crate.webp',
                width: 270,
                fit: BoxFit.contain,
              ),
            ),
          ],
        ),
        Container(
          color: footerGreen,
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Transform.translate(
                  offset: const Offset(10, -24),
                  child: GestureDetector(
                    onTap: () => context.go(RoutePaths.home),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [
                          BoxShadow(color: Color(0x40000000), blurRadius: 20, offset: Offset(0, 8)),
                        ],
                      ),
                      child: Image.asset('assets/images/web_logo.png', height: 32),
                    ),
                  ),
                ),
              ),
              Container(
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: divider))),
                padding: const EdgeInsets.only(bottom: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    accordionHeader('MENU', _menuOpen, () => setState(() => _menuOpen = !_menuOpen)),
                    if (_menuOpen)
                      for (var i = 0; i < _menu.length; i++)
                        InkWell(
                          onTap: () => _go(_menu[i].$2),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: i == 0
                                ? null
                                : BoxDecoration(
                                    border: Border(
                                      top: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
                                    ),
                                  ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(_menu[i].$1, style: white.copyWith(fontSize: 14.5)),
                                ),
                                Icon(
                                  Icons.chevron_right_rounded,
                                  size: 18,
                                  color: Colors.white.withValues(alpha: 0.75),
                                ),
                              ],
                            ),
                          ),
                        ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: divider))),
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    accordionHeader(
                      'CONTACTS',
                      _contactsOpen,
                      () => setState(() => _contactsOpen = !_contactsOpen),
                    ),
                    if (_contactsOpen) ...[
                      const SizedBox(height: 4),
                      contactRow(
                        Icons.location_on_rounded,
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'GreenGrocc Corporate Office',
                              style: white.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              ContactConfig.contactAddress,
                              style: white.copyWith(
                                fontSize: 12,
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      contactRow(
                        Icons.phone_rounded,
                        Text(
                          ContactConfig.contactPhoneDisplay,
                          style: white.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
                        ),
                        onTap: () => _open(ContactConfig.contactPhoneTel),
                      ),
                      const SizedBox(height: 16),
                      contactRow(
                        Icons.email_rounded,
                        Text(
                          ContactConfig.contactEmail,
                          overflow: TextOverflow.ellipsis,
                          style: white.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
                        ),
                        onTap: () => _open('mailto:${ContactConfig.contactEmail}'),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'DOWNLOAD THE APP',
                style: white.copyWith(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 0.65),
              ),
              const SizedBox(height: 12),
              const Row(
                children: [
                  Flexible(child: _StoreBadge(apple: true)),
                  SizedBox(width: 12),
                  Flexible(child: _StoreBadge(apple: false)),
                ],
              ),
              const SizedBox(height: 32),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  socialIcon(Icons.facebook_rounded, _socialUrl('facebook')),
                  const SizedBox(width: 16),
                  socialIcon(Icons.camera_alt_outlined, _socialUrl('instagram')),
                  const SizedBox(width: 16),
                  socialIcon(Icons.work_outline_rounded, null),
                  const SizedBox(width: 16),
                  socialIcon(Icons.alternate_email_rounded, null),
                ],
              ),
              const SizedBox(height: 40),
              Divider(color: Colors.white.withValues(alpha: 0.15), height: 1),
              const SizedBox(height: 24),
              Center(
                child: Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    Text('© ${DateTime.now().year}, GreenGrocc', style: legal),
                    Text('|', style: legal.copyWith(color: Colors.white60)),
                    GestureDetector(
                      onTap: () => context.push(RoutePaths.privacyPolicy),
                      child: Text('Privacy Policy', style: legal),
                    ),
                    Text('|', style: legal.copyWith(color: Colors.white60)),
                    GestureDetector(
                      onTap: () => context.push(RoutePaths.shippingDetails),
                      child: Text('Shipping Policy', style: legal),
                    ),
                    Text('|', style: legal.copyWith(color: Colors.white60)),
                    GestureDetector(
                      onTap: () => context.push(RoutePaths.refundPolicy),
                      child: Text('Return & Refund', style: legal),
                    ),
                    Text('|', style: legal.copyWith(color: Colors.white60)),
                    GestureDetector(
                      onTap: () => context.push(RoutePaths.terms),
                      child: Text('Terms & Conditions', style: legal),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 112),
            ],
          ),
        ),
      ],
    );
  }

  static String? _socialUrl(String platform) {
    for (final link in ContactConfig.socialLinks) {
      if (link.platform == platform) return link.href;
    }
    return null;
  }
}

class _StoreBadge extends StatelessWidget {
  const _StoreBadge({required this.apple});

  final bool apple;

  @override
  Widget build(BuildContext context) {
    final fg = apple ? const Color(0xFF171717) : Colors.white;
    final badge = Container(
      constraints: const BoxConstraints(maxWidth: 170),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: apple ? Colors.white : Colors.black,
        borderRadius: BorderRadius.circular(999),
        border: apple ? null : Border.all(color: Colors.white.withValues(alpha: 0.2)),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2))],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(apple ? Icons.apple : Icons.play_arrow_rounded, size: 20, color: apple ? fg : const Color(0xFF34A853)),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  apple ? 'DOWNLOAD ON THE' : 'GET IT ON',
                  maxLines: 1,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 7.5,
                    fontWeight: FontWeight.w600,
                    color: apple ? const Color(0xFF525252) : const Color(0xFFA3A3A3),
                    height: 1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  apple ? 'App Store' : 'Google Play',
                  maxLines: 1,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: fg,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    if (apple) return badge;
    return GestureDetector(
      onTap: () => launchUrl(Uri.parse(ContactConfig.playStoreUrl), mode: LaunchMode.externalApplication),
      child: badge,
    );
  }
}

/// Website `M0,120 Q500,5 1000,120` dome on top of the green block.
class _DomePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const arc = 71.0;
    final path = Path()
      ..moveTo(0, arc)
      ..quadraticBezierTo(size.width / 2, 3, size.width, arc)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = footerGreen);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
