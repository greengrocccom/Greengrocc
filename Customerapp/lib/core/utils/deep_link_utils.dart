/// Maps incoming deep-link URIs to in-app go_router paths.
String? mapDeepLinkToRoute(Uri uri) {
  var path = uri.path.isEmpty ? '/' : uri.path;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.substring(0, path.length - 1);
  }

  final productMatch = RegExp(r'^/product/([^/]+)$').firstMatch(path);
  if (productMatch != null) {
    final productId = productMatch.group(1);
    if (productId != null && productId.isNotEmpty) {
      return '/product/$productId';
    }
  }

  const staticRoutes = {
    '/',
    '/product',
    '/cart',
    '/wishlist',
    '/checkout',
    '/orders',
    '/profile',
    '/support',
    '/about',
    '/contact',
    '/blog',
    '/privacy-policy',
    '/terms-and-conditions',
    '/shipping-details',
    '/return-refund-policy',
    '/policies',
  };

  if (staticRoutes.contains(path)) return path;
  if (path.startsWith('/orders/')) return path;

  // Custom scheme: greengrocc://product/<id>
  if (uri.scheme == 'greengrocc' && uri.host == 'product' && uri.pathSegments.isNotEmpty) {
    return '/product/${uri.pathSegments.first}';
  }

  return null;
}
