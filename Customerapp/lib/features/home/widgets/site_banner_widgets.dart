import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../../core/utils/optimized_image_url.dart';
import '../../../models/site_banner.dart';
import '../../../widgets/common/app_network_image.dart';
import '../../../routes/route_paths.dart';
import '../home_providers.dart';

/// Same side gutter and vertical rhythm for every home banner block.
const kHomeSectionPadding = EdgeInsets.symmetric(horizontal: 12, vertical: 8);

/// Opens a banner the way the website does: video modal, external URL, or in-app path.
void openSiteBanner(BuildContext context, SiteBanner banner) {
  if (banner.hasVideo) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => _BannerVideoDialog(banner: banner),
    );
    return;
  }
  final link = banner.linkUrl.trim();
  if (link.startsWith('http://') || link.startsWith('https://')) {
    launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    return;
  }
  context.push(link.startsWith('/') ? link : RoutePaths.product);
}

/// Image width/height ratio, resolved once from the network image.
class _NaturalAspect extends StatefulWidget {
  const _NaturalAspect({required this.imageUrl, required this.fallback, required this.builder});

  final String imageUrl;
  final double fallback;
  final Widget Function(double aspect) builder;

  @override
  State<_NaturalAspect> createState() => _NaturalAspectState();
}

class _NaturalAspectState extends State<_NaturalAspect> {
  static final Map<String, double> _cache = {};
  ImageStream? _stream;
  ImageStreamListener? _listener;
  late double _aspect = _cache[widget.imageUrl] ?? widget.fallback;

  @override
  void initState() {
    super.initState();
    if (_cache.containsKey(widget.imageUrl)) return;
    _stream = CachedNetworkImageProvider(optimizedImageUrl(widget.imageUrl)).resolve(ImageConfiguration.empty);
    _listener = ImageStreamListener(
      (info, _) {
        final w = info.image.width.toDouble();
        final h = info.image.height.toDouble();
        if (w > 0 && h > 0) {
          _cache[widget.imageUrl] = w / h;
          if (mounted) setState(() => _aspect = w / h);
        }
      },
      onError: (_, _) {},
    );
    _stream!.addListener(_listener!);
  }

  @override
  void dispose() {
    if (_listener != null) _stream?.removeListener(_listener!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(_aspect);
}

/// Auto-rotating banner carousel (website hero / mid sliders). Hidden when empty.
class SiteBannerCarousel extends ConsumerStatefulWidget {
  const SiteBannerCarousel({
    super.key,
    required this.slot,
    this.padding = EdgeInsets.zero,
    this.radius = 0,
    this.interval = const Duration(milliseconds: 4500),
    this.fallbackAspect = 3 / 2,
  });

  final BannerSlot slot;
  final EdgeInsets padding;
  final double radius;
  final Duration interval;
  final double fallbackAspect;

  @override
  ConsumerState<SiteBannerCarousel> createState() => _SiteBannerCarouselState();
}

class _SiteBannerCarouselState extends ConsumerState<SiteBannerCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _index = 0;
  int _count = 0;

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _ensureTimer(int count) {
    if (count == _count) return;
    _count = count;
    _timer?.cancel();
    if (count < 2) return;
    _timer = Timer.periodic(widget.interval, (_) {
      if (!mounted || !_controller.hasClients) return;
      _controller.animateToPage(
        (_index + 1) % _count,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(siteBannersProvider(widget.slot));
    return async.when(
      loading: () => Padding(
        padding: widget.padding,
        child: AspectRatio(
          aspectRatio: widget.fallbackAspect,
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(widget.radius),
            ),
          ),
        ),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (banners) {
        if (banners.isEmpty) return const SizedBox.shrink();
        _ensureTimer(banners.length);
        return Padding(
          padding: widget.padding,
          child: _NaturalAspect(
            imageUrl: banners.first.imageUrl,
            fallback: widget.fallbackAspect,
            builder: (aspect) => AspectRatio(
              aspectRatio: aspect,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(widget.radius),
                child: Stack(
                  children: [
                    PageView.builder(
                      controller: _controller,
                      itemCount: banners.length,
                      onPageChanged: (i) => setState(() => _index = i),
                      itemBuilder: (context, i) => GestureDetector(
                        onTap: () => openSiteBanner(context, banners[i]),
                        child: AppNetworkImage(
                          imageUrl: banners[i].imageUrl,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          placeholder: const ColoredBox(color: Color(0xFFECFDF5)),
                        ),
                      ),
                    ),
                    if (banners.length > 1)
                      Positioned(
                        bottom: 10,
                        left: 0,
                        right: 0,
                        child: Center(child: _Dots(count: banners.length, index: _index)),
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0x40000000),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(count, (i) {
          final active = i == index;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            margin: const EdgeInsets.symmetric(horizontal: 3),
            width: active ? 24 : 6,
            height: 6,
            decoration: BoxDecoration(
              color: active ? Colors.white : Colors.white60,
              borderRadius: BorderRadius.circular(3),
            ),
          );
        }),
      ),
    );
  }
}

/// Website FarmProduceDualBanners (mobile): two stacked 128px image tiles from the
/// `stories` placement — farmer stories on one, everything else on the other.
class StoriesDualBanners extends ConsumerWidget {
  const StoriesDualBanners({super.key, required this.section});

  final String section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final banners =
        ref.watch(siteBannersProvider((section: section, placement: 'stories'))).value ??
            const <SiteBanner>[];
    if (banners.isEmpty) return const SizedBox.shrink();
    final stories = banners.where((b) => b.category == 'farmerstories').toList();
    final others = banners.where((b) => b.category != 'farmerstories').toList();
    final tiles = [others, stories].where((l) => l.isNotEmpty).toList();

    return Padding(
      padding: kHomeSectionPadding,
      child: Column(
        children: [
          for (var i = 0; i < tiles.length; i++) ...[
            if (i > 0) const SizedBox(height: 14),
            _RotatingTile(banners: tiles[i]),
          ],
        ],
      ),
    );
  }
}

class _RotatingTile extends StatefulWidget {
  const _RotatingTile({required this.banners});

  final List<SiteBanner> banners;

  @override
  State<_RotatingTile> createState() => _RotatingTileState();
}

class _RotatingTileState extends State<_RotatingTile> {
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    if (widget.banners.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (mounted) setState(() => _index = (_index + 1) % widget.banners.length);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final banner = widget.banners[_index % widget.banners.length];
    return GestureDetector(
      onTap: () => openSiteBanner(context, banner),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 128,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                child: AppNetworkImage(
                  key: ValueKey(banner.id),
                  imageUrl: banner.imageUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: 128,
                ),
              ),
              if (widget.banners.length > 1)
                Positioned(
                  bottom: 6,
                  left: 0,
                  right: 0,
                  child: Center(child: _Dots(count: widget.banners.length, index: _index)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BannerVideoDialog extends StatefulWidget {
  const _BannerVideoDialog({required this.banner});

  final SiteBanner banner;

  @override
  State<_BannerVideoDialog> createState() => _BannerVideoDialogState();
}

class _BannerVideoDialogState extends State<_BannerVideoDialog> {
  late final VideoPlayerController _video =
      VideoPlayerController.networkUrl(Uri.parse(widget.banner.videoUrl));

  @override
  void initState() {
    super.initState();
    _video.initialize().then((_) {
      if (!mounted) return;
      setState(() {});
      _video.play();
    });
  }

  @override
  void dispose() {
    _video.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.banner;
    final white = GoogleFonts.notoSansDevanagari(color: Colors.white);
    return Dialog(
      insetPadding: const EdgeInsets.all(12),
      backgroundColor: Colors.black,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: const Color(0xFF111827),
            padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome, size: 16, color: Color(0xFF34D399)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        b.title.isNotEmpty ? b.title : 'शेतकऱ्यांची खरी गोष्ट (Farmer Story)',
                        style: white.copyWith(fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        'शेतापासून थेट तुमच्या स्वयंपाकघरापर्यंत',
                        style: white.copyWith(fontSize: 11, color: const Color(0xFF34D399)),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                ),
              ],
            ),
          ),
          AspectRatio(
            aspectRatio: 16 / 9,
            child: _video.value.isInitialized
                ? GestureDetector(
                    onTap: () => setState(
                      () => _video.value.isPlaying ? _video.pause() : _video.play(),
                    ),
                    child: FittedBox(
                      fit: BoxFit.contain,
                      child: SizedBox(
                        width: _video.value.size.width,
                        height: _video.value.size.height,
                        child: VideoPlayer(_video),
                      ),
                    ),
                  )
                : const Center(child: CircularProgressIndicator(color: Colors.white)),
          ),
          Container(
            color: const Color(0xFF111827),
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    b.subtitle,
                    style: white.copyWith(fontSize: 11, color: const Color(0xFFD1D5DB)),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    shape: const StadiumBorder(),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    minimumSize: const Size(0, 30),
                  ),
                  child: Text('बंद करा', style: white.copyWith(fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Color? _parseHex(String value) {
  var hex = value.trim().replaceAll('#', '');
  if (hex.length == 3) hex = hex.split('').map((c) => '$c$c').join();
  if (hex.length != 6) return null;
  final n = int.tryParse(hex, radix: 16);
  return n == null ? null : Color(0xFF000000 | n);
}

/// Website leaf glyph (`LeafMark`).
class LeafMark extends StatelessWidget {
  const LeafMark({super.key, this.size = 16, this.color = const Color(0xFF1F8A3B)});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Icon(Icons.eco_rounded, size: size, color: color);
}

/// Website OfferBannerCarousel: 1024:342 banner, left fade with tag / title /
/// subtitle / offer text, "Shop Now →" pill and the Fresh-Healthy-Trusted badge.
class OfferBannerCarousel extends StatefulWidget {
  const OfferBannerCarousel({
    super.key,
    required this.banners,
    this.padding = kHomeSectionPadding,
  });

  final List<SiteBanner> banners;
  final EdgeInsets padding;

  @override
  State<OfferBannerCarousel> createState() => _OfferBannerCarouselState();
}

class _OfferBannerCarouselState extends State<OfferBannerCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    if (widget.banners.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!mounted || !_controller.hasClients) return;
        _controller.animateToPage(
          (_index + 1) % widget.banners.length,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeOutCubic,
        );
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: widget.padding,
      child: Column(
        children: [
          AspectRatio(
            aspectRatio: 1024 / 342,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: PageView.builder(
                controller: _controller,
                itemCount: widget.banners.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _OfferSlide(banner: widget.banners[i]),
              ),
            ),
          ),
          if (widget.banners.length > 1) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(widget.banners.length, (i) {
                final active = i == _index;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: active ? 32 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFF1F8A3B) : const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
          ],
        ],
      ),
    );
  }
}

class _OfferSlide extends StatelessWidget {
  const _OfferSlide({required this.banner});

  final SiteBanner banner;

  @override
  Widget build(BuildContext context) {
    final base = _parseHex(banner.bgColor) ?? const Color(0xFFF4FBF2);
    final font = GoogleFonts.plusJakartaSans();
    return GestureDetector(
      onTap: () => openSiteBanner(context, banner),
      child: LayoutBuilder(
        builder: (context, box) => Stack(
          fit: StackFit.expand,
          children: [
            AppNetworkImage(
              imageUrl: banner.imageUrl,
              fit: BoxFit.cover,
            ),
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: box.maxWidth * 0.68,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [base, base.withValues(alpha: 0.8), base.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 12,
              top: 0,
              bottom: 0,
              width: box.maxWidth * 0.68 - 12,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (banner.tag.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1F8A3B),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const LeafMark(size: 11, color: Colors.white),
                          const SizedBox(width: 3),
                          Flexible(
                            child: Text(
                              banner.tag.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: font.copyWith(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.4,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (banner.title.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(
                        banner.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: font.copyWith(
                          fontSize: 15,
                          height: 1.05,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF145C32),
                        ),
                      ),
                    ),
                  if (banner.subtitle.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        banner.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: font.copyWith(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF334155),
                        ),
                      ),
                    ),
                  if (banner.offerText.isNotEmpty)
                    Text(
                      banner.offerText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: font.copyWith(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                  const SizedBox(height: 5),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF145C32),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Shop Now →',
                      style: font.copyWith(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              right: 8,
              bottom: 8,
              child: Container(
                width: 50,
                height: 50,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: Color(0xFF1F8A3B),
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: Color(0x33000000), blurRadius: 6)],
                ),
                child: Text(
                  'Fresh\nHealthy\nTrusted',
                  textAlign: TextAlign.center,
                  style: font.copyWith(
                    fontSize: 7.5,
                    height: 1.15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Website TopPaymentOffersSection payment chips.
const _paymentOffers = [
  (
    id: 'sbi',
    discount: '10% Instant Discount*',
    desc: 'with SBI Credit Card & EMI Txns',
    bg: Color(0xFFE7F6FF),
    border: Color(0xFFC5E6F8),
  ),
  (
    id: 'flipkart',
    discount: 'Get 10% Savings*',
    desc: 'with Flipkart Axis Bank Credit Card',
    bg: Color(0xFFFFF6DE),
    border: Color(0xFFF3E2A8),
  ),
  (
    id: 'hdfc',
    discount: 'Flat ₹100 Cashback*',
    desc: 'on HDFC Bank PayZapp & Cards',
    bg: Color(0xFFF7F2FF),
    border: Color(0xFFE4D7F5),
  ),
  (
    id: 'paytm',
    discount: 'Up to ₹75 Cashback*',
    desc: 'on Paytm UPI transactions',
    bg: Color(0xFFE7F7FF),
    border: Color(0xFFC9E8F6),
  ),
];

Widget _paymentLogo(String id) {
  final font = GoogleFonts.plusJakartaSans();
  Widget box(Color bg, Widget child, {double radius = 6, double? width = 28}) => Container(
        width: width,
        height: 28,
        padding: width == null ? const EdgeInsets.symmetric(horizontal: 6) : null,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(radius)),
        child: child,
      );
  switch (id) {
    case 'sbi':
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          box(
            const Color(0xFF00A3E0),
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
            radius: 14,
          ),
          const SizedBox(width: 6),
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: 'SBI '),
                TextSpan(
                  text: 'card',
                  style: font.copyWith(fontWeight: FontWeight.w700, color: const Color(0xFF00A3E0)),
                ),
              ],
            ),
            style: font.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF1E293B),
            ),
          ),
        ],
      );
    case 'flipkart':
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          box(
            const Color(0xFFFFE11B),
            Text(
              'f',
              style: font.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF2874F0),
              ),
            ),
          ),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Flipkart',
                  style: font.copyWith(fontSize: 12, fontWeight: FontWeight.w800, height: 1.1)),
              Text('Axis',
                  style: font.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF475569),
                    height: 1.1,
                  )),
            ],
          ),
        ],
      );
    case 'hdfc':
      final blue = font.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: const Color(0xFF004C8F),
        height: 1.1,
      );
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          box(
            const Color(0xFFE31E24),
            Text('HDFC',
                style: font.copyWith(
                    fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white)),
          ),
          const SizedBox(width: 6),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('HDFC', style: blue),
              Text('BANK', style: blue.copyWith(fontSize: 10)),
            ],
          ),
        ],
      );
    default:
      return box(
        const Color(0xFF00B9F1),
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('pay',
                style: font.copyWith(
                    fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white, height: 1)),
            Text('UPI',
                style: font.copyWith(
                    fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white, height: 1)),
          ],
        ),
        width: null,
      );
  }
}

/// Website TopPaymentOffersSection: heading, payment chips, `offer` banners.
class TopOffersSection extends ConsumerWidget {
  const TopOffersSection({super.key, required this.section});

  final String section;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final banners =
        ref.watch(siteBannersProvider((section: section, placement: 'offer'))).value ??
            const <SiteBanner>[];
    final font = GoogleFonts.plusJakartaSans();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                const LeafMark(size: 20),
                const SizedBox(width: 8),
                Text(
                  'Top Offers',
                  style: font.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _paymentOffers.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, i) {
                final o = _paymentOffers[i];
                return Container(
                  width: 250,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: o.bg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: o.border),
                  ),
                  child: Row(
                    children: [
                      _paymentLogo(o.id),
                      const SizedBox(width: 8),
                      Container(width: 1, height: 30, color: const Color(0x1A000000)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              o.discount,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: font.copyWith(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              o.desc,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: font.copyWith(
                                fontSize: 10.5,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          size: 16, color: Color(0xFF94A3B8)),
                    ],
                  ),
                );
              },
            ),
          ),
          if (banners.isNotEmpty)
            OfferBannerCarousel(
              banners: banners,
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
            ),
        ],
      ),
    );
  }
}
