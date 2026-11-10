import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/app_info.dart';
import '../../core/providers/package_info_provider.dart';
import '../../core/scroll/app_scroll_config.dart';
import '../../core/scroll/tab_scroll_registry.dart';
import '../../core/utils/address_utils.dart';
import '../../core/utils/website_share.dart';
import '../../features/address/address_controller.dart';
import '../../features/auth/auth_controller.dart';
import '../../models/address.dart';
import '../../models/user.dart';
import '../../routes/route_paths.dart';
import '../../widgets/address/address_form.dart';
import '../../widgets/common/refreshable_body.dart';
import '../../widgets/common/skeleton_loaders.dart';
import '../../widgets/layout/shell_bottom_insets.dart';

String _profileInitials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return 'G';
  if (parts.length == 1) return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late final TabScrollRegistry _tabScrollRegistry;
  final _scrollController = ScrollController();
  final _addressesSectionKey = GlobalKey();

  bool _showAddressForm = false;
  Address? _editingAddress;
  bool _savingAddress = false;
  String? _formError;
  bool _isAddressesExpanded = true;

  @override
  void initState() {
    super.initState();
    _tabScrollRegistry = ref.read(tabScrollRegistryProvider);
    Future.microtask(() {
      if (mounted) {
        ref.read(addressControllerProvider.notifier).loadAddresses();
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tabScrollRegistry.register(ShellTabIndex.account, _scrollController);
    });
  }

  @override
  void dispose() {
    _tabScrollRegistry.unregister(ShellTabIndex.account, _scrollController);
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _refreshProfile() async {
    await ref.read(addressControllerProvider.notifier).loadAddresses();
  }

  void _scrollToAddresses() {
    final context = _addressesSectionKey.currentContext;
    if (context != null) {
      Scrollable.ensureVisible(
        context,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  void _openAddressesDropdown() {
    setState(() {
      _isAddressesExpanded = true;
    });
    ref.read(addressControllerProvider.notifier).loadAddresses();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToAddresses();
    });
  }

  void _toggleAddressesDropdown() {
    setState(() {
      _isAddressesExpanded = !_isAddressesExpanded;
    });
    if (_isAddressesExpanded) {
      ref.read(addressControllerProvider.notifier).loadAddresses();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToAddresses();
      });
    }
  }

  Future<void> _handleSaveAddress(Map<String, String> form) async {
    setState(() {
      _savingAddress = true;
      _formError = null;
    });

    final error = await ref.read(addressControllerProvider.notifier).saveAddress(
          form,
          editing: _editingAddress,
          makeDefault: _editingAddress == null &&
              ref.read(addressControllerProvider).addresses.isEmpty,
        );

    if (!mounted) return;

    setState(() {
      _savingAddress = false;
      if (error == null) {
        _showAddressForm = false;
        _editingAddress = null;
      } else {
        _formError = error;
      }
    });
  }

  Future<void> _handleDeleteAddress(Address address) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Remove address?'),
        content: const Text('This address will be removed from your saved list.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Remove', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final error =
        await ref.read(addressControllerProvider.notifier).deleteAddress(address.id);
    if (error != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
    }
  }

  Future<void> _editProfileField({
    required String title,
    required String fieldKey,
    required String initialValue,
    TextInputType keyboardType = TextInputType.text,
  }) async {
    final controller = TextEditingController(text: initialValue);
    final result = await showDialog<String?>(
      context: context,
      builder: (context) {
        String? localError;
        return StatefulBuilder(
          builder: (context, setLocalState) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Text('Edit $title', style: const TextStyle(fontWeight: FontWeight.bold)),
            content: TextField(
              controller: controller,
              keyboardType: keyboardType,
              autofocus: true,
              decoration: InputDecoration(
                labelText: title,
                hintText: 'Enter your $title',
                errorText: localError,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  final value = controller.text.trim();
                  if (value.isEmpty) {
                    setLocalState(() => localError = '$title is required');
                    return;
                  }
                  Navigator.pop(context, value);
                },
                child: const Text('Save'),
              ),
            ],
          ),
        );
      },
    );

    if (result == null || !mounted) return;

    final updateError = await ref.read(authControllerProvider.notifier).updateProfile({
      fieldKey: result,
    });

    if (!mounted) return;
    if (updateError != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(updateError)));
    }
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Log out of GreenGrocc?'),
        content: const Text('You will need to sign in again to access your account and saved addresses.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      ref.read(authControllerProvider.notifier).logout();
    }
  }

  Future<void> _handleShare() async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await shareWebsite();
    } catch (_) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Could not share website. Try again.')),
      );
    }
  }

  Widget _buildMenuSection(BuildContext context) {
    return _MenuSection(
      onSupport: () => context.push(RoutePaths.support),
      onPrivacy: () => context.push(RoutePaths.privacyPolicy),
      onTerms: () => context.push(RoutePaths.terms),
      onRefund: () => context.push(RoutePaths.refundPolicy),
      onShipping: () => context.push(RoutePaths.shippingDetails),
      onContact: () => context.push(RoutePaths.contact),
      onAbout: () => context.push(RoutePaths.about),
      onShare: _handleShare,
    );
  }

  Widget _buildVersionLabel() {
    const style = TextStyle(fontSize: 12, color: _slate400);
    return Center(
      child: ref.watch(packageInfoProvider).when(
            loading: () => Text('${AppInfo.name} v${AppInfo.version}', style: style),
            error: (_, _) => Text('${AppInfo.name} v${AppInfo.version}', style: style),
            data: (info) => Text(
              '${AppInfo.name} v${info.version}',
              style: style.copyWith(fontWeight: FontWeight.w500),
            ),
          ),
    );
  }

  Widget _buildScrollView(
    BuildContext context, {
    required Widget header,
    required List<Widget> children,
  }) {
    final topInset = MediaQuery.paddingOf(context).top;
    return ColoredBox(
      color: _pageBg,
      child: Column(
        children: [
          DecoratedBox(
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: _borderGray)),
            ),
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, topInset + 12, 16, 12),
              child: header,
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refreshProfile,
              color: _brandGreen,
              child: ListView(
                controller: _scrollController,
                physics: AppScrollConfig.listPhysics,
                cacheExtent: AppScrollConfig.cacheExtent,
                padding: ShellBottomInsets.listPadding(
                  context,
                  left: 16,
                  top: 16,
                  right: 16,
                ),
                children: [
                  for (var i = 0; i < children.length; i++) ...[
                    if (i > 0) const SizedBox(height: 16),
                    children[i],
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    final user = ref.watch(authControllerProvider.select((s) => s.user));
    final addresses = ref.watch(addressControllerProvider.select((s) => s.addresses));
    final addressesLoading =
        ref.watch(addressControllerProvider.select((s) => s.loading));

    if (!isLoggedIn) {
      return _buildScrollView(context,
          header: const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'My Account',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: _slate900,
                letterSpacing: -0.3,
              ),
            ),
          ),
          children: [
        _WelcomeCard(
          onLogin: () => ref.read(authControllerProvider.notifier).openAuthModal(
                AuthModalMode.login,
                RoutePaths.profile,
              ),
        ),
        _QuickActionsGrid(
          onAddresses: () => ref.read(authControllerProvider.notifier).openAuthModal(
                AuthModalMode.login,
                RoutePaths.profile,
              ),
          onOrders: () => context.go(RoutePaths.orders),
          onSupport: () => context.push(RoutePaths.support),
          onWishlist: () => context.push(RoutePaths.wishlist),
        ),
        _buildMenuSection(context),
        _buildVersionLabel(),
      ]);
    }

    if (user == null) {
      return RefreshableBody(
        onRefresh: _refreshProfile,
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    return _buildScrollView(context,
        header: _GreetingHeader(user: user, onLogout: _handleLogout),
        children: [
      _ProfileInfoCard(
        user: user,
        onEditName: () => _editProfileField(
          title: 'Name',
          fieldKey: 'name',
          initialValue: user.name,
        ),
        onEditEmail: () => _editProfileField(
          title: 'Email',
          fieldKey: 'email',
          initialValue: user.email,
          keyboardType: TextInputType.emailAddress,
        ),
        onEditPhone: () => _editProfileField(
          title: 'Phone Number',
          fieldKey: 'phone',
          initialValue: user.phone,
          keyboardType: TextInputType.phone,
        ),
      ),
      _QuickActionsGrid(
        onAddresses: _openAddressesDropdown,
        onOrders: () => context.go(RoutePaths.orders),
        onSupport: () => context.push(RoutePaths.support),
        onWishlist: () => context.push(RoutePaths.wishlist),
      ),
      _SavedAddressesSection(
        sectionKey: _addressesSectionKey,
        isExpanded: _isAddressesExpanded,
        onToggleExpand: _toggleAddressesDropdown,
        addresses: addresses,
        loading: addressesLoading,
        showForm: _showAddressForm,
        editingAddress: _editingAddress,
        savingAddress: _savingAddress,
        formError: _formError,
        onAddAddress: () => setState(() {
          _isAddressesExpanded = true;
          _editingAddress = null;
          _showAddressForm = true;
          _formError = null;
        }),
        onCancelForm: () => setState(() {
          _showAddressForm = false;
          _editingAddress = null;
          _formError = null;
        }),
        onSubmitForm: _handleSaveAddress,
        onEditAddress: (address) => setState(() {
          _isAddressesExpanded = true;
          _editingAddress = address;
          _showAddressForm = true;
          _formError = null;
        }),
        onDeleteAddress: _handleDeleteAddress,
      ),
      _buildMenuSection(context),
      _LogoutButton(onTap: _handleLogout),
      _buildVersionLabel(),
    ]);
  }
}

const _pageBg = Colors.white;
const _brandGreen = Color(0xFF0C831F);
const _green500 = Color(0xFF22C55E);
const _green600 = Color(0xFF16A34A);
const _green100 = Color(0xFFDCFCE7);
const _borderGray = Color(0xFFE5E7EB);
const _slate900 = Color(0xFF0F172A);
const _slate500 = Color(0xFF64748B);
const _slate400 = Color(0xFF94A3B8);
const _peach = Color(0xFFFFE8D4);
const _quickLinksBg = Color(0xFFFFF5ED);
const _red600 = Color(0xFFDC2626);
const _red200 = Color(0xFFFECACA);
const _red50 = Color(0xFFFEF2F2);

const _cardShadow = [
  BoxShadow(
    color: Color(0x0D000000),
    blurRadius: 3,
    offset: Offset(0, 1),
  ),
];

String _firstName(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  return parts.isEmpty ? 'there' : parts.first;
}

class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _borderGray),
        boxShadow: _cardShadow,
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(color: _peach, shape: BoxShape.circle),
            child: const Icon(Icons.person_outline_rounded, size: 34, color: _brandGreen),
          ),
          const SizedBox(height: 14),
          const Text(
            'Welcome to GreenGrocc',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: _slate900),
          ),
          const SizedBox(height: 6),
          const Text(
            'Sign in to manage your account details, saved addresses & quick checkout.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _slate500, fontSize: 13, height: 1.45),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: _brandGreen,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              ),
              onPressed: onLogin,
              child: const Text(
                'Login / Sign Up',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GreetingHeader extends StatelessWidget {
  const _GreetingHeader({required this.user, required this.onLogout});

  final User user;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Hi, ${_firstName(user.name)} \u{1F44B}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: _slate900,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Manage your profile & addresses',
                style: TextStyle(fontSize: 13, color: _slate500),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Material(
          color: _red50,
          shape: const StadiumBorder(side: BorderSide(color: _red200)),
          child: InkWell(
            onTap: onLogout,
            customBorder: const StadiumBorder(),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.logout_rounded, size: 14, color: _red600),
                  SizedBox(width: 5),
                  Text(
                    'Logout',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _red600),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _peach,
            shape: BoxShape.circle,
            border: Border.all(color: _brandGreen.withValues(alpha: 0.15)),
          ),
          child: Text(
            _profileInitials(user.name),
            style: const TextStyle(
              color: _brandGreen,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileInfoCard extends StatelessWidget {
  const _ProfileInfoCard({
    required this.user,
    required this.onEditName,
    required this.onEditEmail,
    required this.onEditPhone,
  });

  final User user;
  final VoidCallback onEditName;
  final VoidCallback onEditEmail;
  final VoidCallback onEditPhone;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _borderGray),
        boxShadow: _cardShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          _ProfileInfoRow(
            icon: Icons.person_outline_rounded,
            label: 'Name',
            value: user.name.isNotEmpty ? user.name : 'GreenGrocc User',
            onEdit: onEditName,
          ),
          const Divider(height: 1, thickness: 1, color: _borderGray, indent: 64),
          _ProfileInfoRow(
            icon: Icons.mail_outline_rounded,
            label: 'Email',
            value: user.email.isNotEmpty ? user.email : 'Not provided',
            onEdit: onEditEmail,
          ),
          const Divider(height: 1, thickness: 1, color: _borderGray, indent: 64),
          _ProfileInfoRow(
            icon: Icons.phone_outlined,
            label: 'Phone Number',
            value: user.phone.isNotEmpty ? user.phone : 'Not provided',
            onEdit: onEditPhone,
          ),
        ],
      ),
    );
  }
}

class _ProfileInfoRow extends StatelessWidget {
  const _ProfileInfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onEdit,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: _green100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: _green600),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 11.5, color: _slate500),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _slate900),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          InkWell(
            onTap: onEdit,
            borderRadius: BorderRadius.circular(6),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Edit',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: _brandGreen),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 16, color: _brandGreen),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionsGrid extends StatelessWidget {
  const _QuickActionsGrid({
    required this.onAddresses,
    required this.onOrders,
    required this.onSupport,
    required this.onWishlist,
  });

  final VoidCallback onAddresses;
  final VoidCallback onOrders;
  final VoidCallback onSupport;
  final VoidCallback onWishlist;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: _quickLinksBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _green500.withValues(alpha: 0.1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _QuickActionTile(icon: Icons.location_on_outlined, label: 'My Addresses', onTap: onAddresses),
          _QuickActionTile(icon: Icons.receipt_long_outlined, label: 'My Orders', onTap: onOrders),
          _QuickActionTile(icon: Icons.support_agent_outlined, label: 'Support', onTap: onSupport),
          _QuickActionTile(icon: Icons.favorite_border_rounded, label: 'Wishlist', onTap: onWishlist),
        ],
      ),
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: _cardShadow,
                ),
                child: Icon(icon, color: _brandGreen, size: 22),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: _slate900,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SavedAddressesSection extends StatelessWidget {
  const _SavedAddressesSection({
    required this.sectionKey,
    required this.isExpanded,
    required this.onToggleExpand,
    required this.addresses,
    required this.loading,
    required this.showForm,
    required this.editingAddress,
    required this.savingAddress,
    required this.formError,
    required this.onAddAddress,
    required this.onCancelForm,
    required this.onSubmitForm,
    required this.onEditAddress,
    required this.onDeleteAddress,
  });

  final Key sectionKey;
  final bool isExpanded;
  final VoidCallback onToggleExpand;
  final List<Address> addresses;
  final bool loading;
  final bool showForm;
  final Address? editingAddress;
  final bool savingAddress;
  final String? formError;
  final VoidCallback onAddAddress;
  final VoidCallback onCancelForm;
  final Future<void> Function(Map<String, String> form) onSubmitForm;
  final ValueChanged<Address> onEditAddress;
  final ValueChanged<Address> onDeleteAddress;

  @override
  Widget build(BuildContext context) {
    final subtitle = addresses.isEmpty
        ? 'Add a delivery location for faster checkout'
        : '${addresses.length} saved ${addresses.length == 1 ? 'address' : 'addresses'}';

    return Column(
      key: sectionKey,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: onToggleExpand,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Saved Addresses',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _slate900),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: const TextStyle(fontSize: 12, color: _slate500),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (!showForm)
                  TextButton(
                    onPressed: onAddAddress,
                    style: TextButton.styleFrom(
                      foregroundColor: _brandGreen,
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      '+ Add Address',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                AnimatedRotation(
                  turns: isExpanded ? 0.5 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(Icons.keyboard_arrow_down_rounded, size: 22, color: _slate500),
                ),
              ],
            ),
          ),
        ),
        if (isExpanded) ...[
          const SizedBox(height: 12),
          if (formError != null && !showForm) ...[
            Text(formError!, style: const TextStyle(color: _red600, fontSize: 13)),
            const SizedBox(height: 10),
          ],
          if (showForm) ...[
            if (formError != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: _red50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(formError!, style: const TextStyle(color: _red600, fontSize: 13)),
              ),
              const SizedBox(height: 10),
            ],
            AddressForm(
              plain: true,
              initial: editingAddress != null ? mapAddressToForm(editingAddress!) : null,
              submitting: savingAddress,
              onCancel: onCancelForm,
              onSubmit: onSubmitForm,
            ),
          ] else if (loading)
            const SkeletonAddressList()
          else if (addresses.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _borderGray),
              ),
              child: Column(
                children: [
                  const Icon(Icons.location_off_outlined, size: 32, color: _slate400),
                  const SizedBox(height: 8),
                  const Text(
                    'No saved addresses yet.',
                    style: TextStyle(fontSize: 13, color: _slate500),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: onAddAddress,
                    style: FilledButton.styleFrom(
                      backgroundColor: _brandGreen,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text(
                      '+ Add Delivery Address',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            )
          else
            Column(
              children: [
                for (var i = 0; i < addresses.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  _AddressCard(
                    address: addresses[i],
                    onEdit: () => onEditAddress(addresses[i]),
                    onDelete: () => onDeleteAddress(addresses[i]),
                  ),
                ],
              ],
            ),
        ],
      ],
    );
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.onEdit,
    required this.onDelete,
  });

  final Address address;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  IconData _getAddressTypeIcon(String tag) {
    final lower = tag.toLowerCase();
    if (lower.contains('home')) return Icons.home_outlined;
    if (lower.contains('work') || lower.contains('office')) return Icons.work_outline;
    return Icons.location_on_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final tagLabel = address.shopName.trim().isNotEmpty
        ? address.shopName.trim()
        : (address.landmark.trim().isNotEmpty ? address.landmark.trim() : 'Address');
    final formattedAddress = formatAddressLine(address);
    final displayAddress = formattedAddress.isNotEmpty
        ? formattedAddress
        : (address.fullAddress.isNotEmpty
            ? address.fullAddress
            : '${address.shopNo} ${address.area} ${address.city} ${address.pincode}'.trim());
    final fullName = getAddressFullName(address);
    final isActive = address.isDefault;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isActive ? _green100.withValues(alpha: 0.4) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isActive ? _green500 : _borderGray),
        boxShadow: isActive ? _cardShadow : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 2),
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isActive ? _brandGreen : Colors.transparent,
                  border: Border.all(
                    color: isActive ? _brandGreen : const Color(0xFFD1D5DB),
                    width: 2,
                  ),
                ),
                child: isActive
                    ? const Icon(Icons.check_rounded, size: 12, color: Colors.white)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3F4F6),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(_getAddressTypeIcon(tagLabel), size: 12, color: const Color(0xFF4B5563)),
                              const SizedBox(width: 3),
                              ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 120),
                                child: Text(
                                  tagLabel.toUpperCase(),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF4B5563),
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (fullName.isNotEmpty)
                          Text(
                            fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: _slate900,
                            ),
                          ),
                        if (isActive)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF059669),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: const Text(
                              'Active Location',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      displayAddress.isNotEmpty ? displayAddress : 'Saved delivery address',
                      style: const TextStyle(color: _slate500, fontSize: 13, height: 1.45),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.phone_outlined, size: 13, color: _slate400),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            address.number.startsWith('+91') ? address.number : '+91 ${address.number}',
                            style: const TextStyle(color: _slate400, fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Divider(height: 1, thickness: 1, color: _borderGray.withValues(alpha: 0.6)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: isActive
                    ? const Row(
                        children: [
                          Icon(Icons.circle, size: 6, color: Color(0xFF059669)),
                          SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              'Currently selected for delivery',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF047857),
                              ),
                            ),
                          ),
                        ],
                      )
                    : const SizedBox.shrink(),
              ),
              InkWell(
                onTap: onEdit,
                borderRadius: BorderRadius.circular(4),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text(
                    'Edit',
                    style: TextStyle(color: _slate500, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: onDelete,
                borderRadius: BorderRadius.circular(4),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text(
                    'Remove',
                    style: TextStyle(color: _red600, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MenuSection extends StatelessWidget {
  const _MenuSection({
    required this.onSupport,
    required this.onPrivacy,
    required this.onTerms,
    required this.onRefund,
    required this.onShipping,
    required this.onContact,
    required this.onAbout,
    required this.onShare,
  });

  final VoidCallback onSupport;
  final VoidCallback onPrivacy;
  final VoidCallback onTerms;
  final VoidCallback onRefund;
  final VoidCallback onShipping;
  final VoidCallback onContact;
  final VoidCallback onAbout;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    const divider = Divider(height: 1, thickness: 1, color: _borderGray, indent: 52);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Support & Legal',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _slate900),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _borderGray),
            boxShadow: _cardShadow,
          ),
          clipBehavior: Clip.antiAlias,
          child: Material(
            color: Colors.transparent,
            child: Column(
              children: [
                _MenuItem(icon: Icons.help_outline_rounded, title: 'Help & Support / FAQs', onTap: onSupport),
                divider,
                _MenuItem(icon: Icons.privacy_tip_outlined, title: 'Privacy Policy', onTap: onPrivacy),
                divider,
                _MenuItem(icon: Icons.article_outlined, title: 'Terms & Conditions', onTap: onTerms),
                divider,
                _MenuItem(icon: Icons.assignment_return_outlined, title: 'Return & Refund Policy', onTap: onRefund),
                divider,
                _MenuItem(icon: Icons.local_shipping_outlined, title: 'Shipping & Delivery Policy', onTap: onShipping),
                divider,
                _MenuItem(icon: Icons.contact_support_outlined, title: 'Contact Us', onTap: onContact),
                divider,
                _MenuItem(icon: Icons.info_outline_rounded, title: 'About GreenGrocc', onTap: onAbout),
                divider,
                _MenuItem(icon: Icons.share_outlined, title: 'Share App / Website', onTap: onShare),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: _slate500, size: 20),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _slate900),
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: _slate400),
          ],
        ),
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      child: OutlinedButton.icon(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: _red600,
          backgroundColor: Colors.white,
          side: const BorderSide(color: _red200),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        icon: const Icon(Icons.logout_rounded, size: 18),
        label: const Text(
          'Log Out',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
