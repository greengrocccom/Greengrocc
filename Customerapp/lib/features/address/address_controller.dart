import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../models/address.dart';
import '../auth/auth_controller.dart';

class AddressState {
  const AddressState({
    this.addresses = const [],
    this.loading = false,
    this.error,
  });

  final List<Address> addresses;
  final bool loading;
  final String? error;

  AddressState copyWith({
    List<Address>? addresses,
    bool? loading,
    String? error,
    bool clearError = false,
  }) {
    return AddressState(
      addresses: addresses ?? this.addresses,
      loading: loading ?? this.loading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

final addressControllerProvider =
    NotifierProvider<AddressController, AddressState>(AddressController.new);

class AddressController extends Notifier<AddressState> {
  @override
  AddressState build() {
    ref.listen(authControllerProvider, (previous, next) {
      if (!next.isLoggedIn) {
        state = const AddressState();
      } else if (previous?.isLoggedIn != true || previous?.user?.id != next.user?.id) {
        state = const AddressState();
        loadAddresses();
      }
    });

    final isLoggedIn = ref.watch(authControllerProvider.select((s) => s.isLoggedIn));
    if (isLoggedIn) {
      Future.microtask(loadAddresses);
    }
    return const AddressState();
  }

  Future<void> loadAddresses() async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isLoggedIn) {
      state = const AddressState();
      return;
    }

    state = state.copyWith(loading: true, clearError: true);
    try {
      final addresses = await ref.read(apiServiceProvider).fetchAddresses();
      state = AddressState(addresses: addresses, loading: false);
    } catch (_) {
      state = const AddressState(
        addresses: [],
        loading: false,
        error: 'Failed to load addresses',
      );
    }
  }

  Future<String?> saveAddress(
    Map<String, String> form, {
    Address? editing,
    bool makeDefault = false,
  }) async {
    state = state.copyWith(clearError: true);
    try {
      final payload = {
        ...form,
        if (makeDefault || state.addresses.isEmpty) 'isDefault': true,
      };

      if (editing != null) {
        final updated =
            await ref.read(apiServiceProvider).editAddress(editing.id, payload);
        state = state.copyWith(
          addresses: state.addresses
              .map((addr) => addr.id == editing.id ? updated : addr)
              .toList(),
        );
      } else {
        final created =
            await ref.read(apiServiceProvider).createAddress(payload);
        state = state.copyWith(addresses: [created, ...state.addresses]);
      }
      return null;
    } catch (e) {
      const message = 'Failed to save address';
      state = state.copyWith(error: message);
      return message;
    }
  }

  Future<String?> deleteAddress(String id) async {
    state = state.copyWith(clearError: true);
    try {
      await ref.read(apiServiceProvider).removeAddress(id);
      state = state.copyWith(
        addresses: state.addresses.where((addr) => addr.id != id).toList(),
      );
      return null;
    } catch (_) {
      const message = 'Failed to delete address';
      state = state.copyWith(error: message);
      return message;
    }
  }
}
