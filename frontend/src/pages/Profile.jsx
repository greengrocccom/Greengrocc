import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "../context/LocationContext";
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getMyOrders,
  getRewardSettings,
} from "../api/api";
import AddressForm, { ADDRESS_FORM_FIELDS } from "../components/address/AddressForm";
import AddressTagBadge from "../components/address/AddressTagBadge";
import BuyAgainCard from "../components/product/BuyAgainCard";
import RewardPointsModal from "../components/rewards/RewardPointsModal";
import {
  formatAddressLine,
  getAddressFullName,
  mapAddressToForm,
  getAddressTypeTag,
  sortAddressesByLatest,
} from "../utils/addressDisplay";
import { extractRecentOrderItems } from "../utils/orderItems";

function profileFirstName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || "there";
}

function profileInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function ProfileInfoRow({ icon, label, value, onEdit, showDivider }) {
  return (
    <div>
      <div className="flex items-center gap-3 px-3.5 py-3.5 sm:px-4 sm:py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-secondary">{label}</p>
          <p className="truncate text-sm font-semibold text-text-primary">{value}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary"
        >
          Edit
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {showDivider ? <div className="ml-[62px] mr-3.5 border-t border-border-light" /> : null}
    </div>
  );
}

function QuickLink({ icon, label, onClick, to }) {
  const content = (
    <>
      <div className="mx-auto flex h-8 w-8 items-center justify-center text-primary">{icon}</div>
      <span className="mt-1.5 block text-center text-[10px] font-semibold leading-tight text-text-primary">
        {label}
      </span>
    </>
  );

  const className = "flex-1 rounded-xl px-1 py-1 transition hover:bg-white/60";

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function Profile() {
  const navigate = useNavigate();
  const { user, openAuthModal, logout, updateProfile } = useAuth();
  const { location, setLocation, hasLocation } = useLocation();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [formError, setFormError] = useState("");
  const [recentItems, setRecentItems] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [addressIndex, setAddressIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [rewardSettings, setRewardSettings] = useState(null);
  const addressesRef = useRef(null);

  useEffect(() => {
    let active = true;
    getRewardSettings()
      .then(({ data }) => {
        if (active && data?.data) {
          setRewardSettings(data.data);
        }
      })
      .catch(() => {
        if (active) setRewardSettings({ enabled: false });
      });

    return () => {
      active = false;
    };
  }, []);

  const rewardsEnabled = rewardSettings?.enabled === true;

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const { data } = await getAddresses();
      setAddresses(sortAddressesByLatest(data.data || []));
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentItems = async () => {
    setRecentLoading(true);
    try {
      const { data } = await getMyOrders();
      setRecentItems(extractRecentOrderItems(data.data || []));
    } catch {
      setRecentItems([]);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAddresses();
      loadRecentItems();
    } else {
      setAddresses([]);
      setRecentItems([]);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (addressIndex >= addresses.length) {
      setAddressIndex(Math.max(0, addresses.length - 1));
    }
  }, [addresses.length, addressIndex]);

  const handleSaveAddress = async (formData) => {
    setSavingAddress(true);
    setFormError("");
    try {
      if (editingAddress) {
        await updateAddress(editingAddress._id, formData);
      } else {
        await addAddress({
          ...formData,
          isDefault: addresses.length === 0,
        });
      }
      await loadAddresses();
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleEditProfileField = async (field, label, currentValue) => {
    const nextValue = window.prompt(`Edit ${label}`, currentValue);
    if (nextValue == null || nextValue.trim() === currentValue) return;

    try {
      await updateProfile({ [field]: nextValue.trim() });
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to update profile");
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
      navigate("/", { replace: true });
    }
  };

  const handleEditAddress = (addr) => {
    setEditingAddress(addr);
    setShowAddressForm(true);
    setFormError("");
  };

  const handleDeleteAddress = async (addrId) => {
    if (!window.confirm("Remove this address?")) return;
    try {
      await deleteAddress(addrId);
      setAddresses((prev) => prev.filter((addr) => addr._id !== addrId));
    } catch {
      setFormError("Failed to delete address");
    }
  };

  const cancelAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    setFormError("");
  };

  const isCurrentDeliveryLocation = (addr) => {
    if (!hasLocation || !location) return false;
    if (addr.location?.lat != null && location.lat != null) {
      if (Math.abs(addr.location.lat - location.lat) < 0.001) {
        return true;
      }
    }
    if (addr.pincode && location.pincode && addr.pincode === location.pincode) {
      if (addr.area && location.area && addr.area === location.area) {
        return true;
      }
      if (addr.city && location.city && addr.city === location.city) {
        return true;
      }
    }
    if (addr.fullAddress && (location.fullAddress || location.address)) {
      if (addr.fullAddress === (location.fullAddress || location.address)) {
        return true;
      }
    }
    return false;
  };

  const handleSelectDeliveryLocation = (addr) => {
    setLocation({
      label: addr.label || addr.area || addr.city || addr.shopName || getAddressFullName(addr) || "Delivery location",
      address: addr.fullAddress || formatAddressLine(addr),
      city: addr.city || "",
      area: addr.area || addr.streetArea || "",
      pincode: addr.pincode || "",
      state: addr.state || "",
      lat: addr.location?.lat,
      lng: addr.location?.lng,
      shopName: addr.shopName || "",
      landmark: addr.landmark || "",
      fullAddress: addr.fullAddress || "",
    });
  };

  const scrollToAddresses = () => {
    addressesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-mobile-bg px-4 pb-24 pt-4">
        <div className="mx-auto max-w-xl rounded-2xl border border-border-light bg-white px-6 py-10 text-center">
          <p className="mb-6 text-sm text-text-secondary">
            Sign in to manage your account and addresses.
          </p>
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="rounded-lg bg-primary px-8 py-3 text-sm font-bold text-white transition hover:brightness-110"
          >
            Login / Sign Up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mobile-bg px-4 pb-24 pt-4 sm:px-6">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Hi, {profileFirstName(user.name)} 👋
            </h1>
            <p className="mt-1 text-sm text-text-secondary">Manage your profile & addresses</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/90 px-3.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300 active:scale-95 shadow-sm"
              title="Log out"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/15 bg-[#FFE8D4] text-base font-bold text-primary">
                {profileInitials(user.name)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border-light bg-white shadow-sm">
                <svg className="h-2.5 w-2.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M4 20h4l10.5-10.5a1.5 1.5 0 00-4.5-4.5L4 15.5V20z" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm">
          <ProfileInfoRow
            icon={
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
            label="Name"
            value={user.name}
            onEdit={() => handleEditProfileField("name", "Name", user.name)}
            showDivider
          />
          <ProfileInfoRow
            icon={
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            label="Email"
            value={user.email || "Not provided"}
            onEdit={() => handleEditProfileField("email", "Email", user.email || "")}
            showDivider
          />
          <ProfileInfoRow
            icon={
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            }
            label="Phone Number"
            value={user.phone || "Not provided"}
            onEdit={() => handleEditProfileField("phone", "Phone Number", user.phone || "")}
            showDivider={false}
          />
        </div>

        {/* Rewards Banner / Wallet Card (Only shown if reward points program is active) */}
        {rewardsEnabled && (
          <button
            type="button"
            onClick={() => setShowRewardsModal(true)}
            className="w-full text-left relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 p-4 text-white shadow-md transition hover:scale-[1.01] active:scale-[0.99] group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-2xl shadow-inner group-hover:rotate-12 transition-transform">
                  🪙
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide backdrop-blur-sm">
                    <span>✨</span> GreenGrocc Rewards
                  </span>
                  <p className="text-xl font-black mt-0.5">
                    {(user.rewardPoints || 0).toLocaleString("en-IN")}{" "}
                    <span className="text-xs font-semibold opacity-95">
                      Points (₹{((user.rewardPoints || 0) * (rewardSettings?.pointValueInRupees || 1.0)).toFixed(2)})
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-sm shadow-sm group-hover:bg-white group-hover:text-amber-800 transition">
                <span>View Passbook</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        )}

        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-primary/10 bg-[#FFF5ED] px-2 py-3">
          {rewardsEnabled ? (
            <QuickLink
              label="My Rewards"
              onClick={() => setShowRewardsModal(true)}
              icon={<span className="text-xl">🪙</span>}
            />
          ) : (
            <QuickLink
              label="My Addresses"
              onClick={scrollToAddresses}
              icon={
                <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          )}
          <QuickLink
            label="My Orders"
            to="/orders"
            icon={
              <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <QuickLink
            label="Support"
            to="/support"
            icon={
              <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18.364 5.636a9 9 0 11-12.728 0M12 9v3.75m0 3.75h.008v.008H12V16.5z"
                />
              </svg>
            }
          />
          {rewardsEnabled ? (
            <QuickLink
              label="Wishlist"
              to="/wishlist"
              icon={
                <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              }
            />
          ) : (
            <QuickLink
              label="Account Settings"
              onClick={() => setShowSettings(true)}
              icon={
                <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          )}
        </div>

        {(recentLoading || recentItems.length > 0) && (
          <section>
            <h2 className="text-base font-bold text-text-primary">Buy Again</h2>
            <p className="mt-0.5 text-sm text-text-secondary">Items from your recent orders</p>
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {recentLoading
                ? [1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-[210px] w-[140px] shrink-0 animate-pulse rounded-2xl bg-mobile-surface"
                    />
                  ))
                : recentItems.map((item) => (
                    <BuyAgainCard
                      key={`${item.productId}-${item.variantName || "default"}-${item.colorName || "default"}`}
                      item={item}
                    />
                  ))}
            </div>
          </section>
        )}

        <section ref={addressesRef}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-text-primary">Saved Addresses</h2>
              {addresses.length > 0 && !showAddressForm && (
                <p className="text-xs text-text-secondary">Showing latest 3 addresses</p>
              )}
            </div>
            {!showAddressForm && (
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null);
                  setShowAddressForm(true);
                  setFormError("");
                }}
                className="text-sm font-semibold text-primary"
              >
                + Add Address
              </button>
            )}
          </div>

          {formError && !showAddressForm && (
            <p className="mb-3 text-sm text-red-600">{formError}</p>
          )}

          {showAddressForm ? (
            <>
              {formError && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
              )}
              <AddressForm
                key={editingAddress?._id || "new"}
                plain
                initial={
                  editingAddress
                    ? mapAddressToForm(editingAddress)
                    : {
                        ...ADDRESS_FORM_FIELDS,
                        fullName: user.name || "",
                        number: user.phone || "",
                        email: user.email || "",
                      }
                }
                onSubmit={handleSaveAddress}
                onCancel={cancelAddressForm}
                submitting={savingAddress}
                existingAddresses={addresses}
                editingId={editingAddress?._id}
              />
            </>
          ) : loading ? (
            <div className="h-52 animate-pulse rounded-2xl border border-border-light bg-white" />
          ) : addresses.length === 0 ? (
            <div className="rounded-2xl border border-border-light bg-white p-6 text-center text-sm text-text-secondary">
              <p>No saved addresses yet.</p>
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null);
                  setShowAddressForm(true);
                  setFormError("");
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:brightness-105"
              >
                + Add Delivery Address
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.slice(0, 3).map((addr, index) => {
                const isActive = isCurrentDeliveryLocation(addr);
                const tag = getAddressTypeTag(addr, index);

                return (
                  <div
                    key={addr._id}
                    className={`rounded-2xl border p-4 transition ${
                      isActive
                        ? "border-primary bg-primary-light/40 shadow-sm ring-1 ring-primary/30"
                        : "border-border-light bg-white hover:border-primary/40 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Radio button to select location */}
                      <button
                        type="button"
                        onClick={() => handleSelectDeliveryLocation(addr)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isActive
                            ? "border-primary bg-primary text-white"
                            : "border-gray-300 hover:border-primary"
                        }`}
                        aria-label={isActive ? "Active delivery location" : "Select as delivery location"}
                      >
                        {isActive ? (
                          <svg className="h-3 w-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </button>

                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleSelectDeliveryLocation(addr)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <AddressTagBadge tag={tag} />
                          <p className="font-bold text-text-primary">
                            {getAddressFullName(addr) || addr.label || tag}
                          </p>
                          {isActive && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              Active Location
                            </span>
                          )}
                          {addr.isDefault && !isActive && (
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                              DEFAULT
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                          {formatAddressLine(addr)}
                        </p>

                        <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          +91 {addr.number}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Deliver Here, Edit, Remove */}
                    <div className="mt-3 flex items-center justify-between border-t border-border-light/60 pt-2.5">
                      <div>
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => handleSelectDeliveryLocation(addr)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                          >
                            <span>Deliver to this address</span>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Currently selected for delivery
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAddress(addr);
                          }}
                          className="text-xs font-semibold text-text-secondary hover:text-primary transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAddress(addr._id);
                          }}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Actions / Logout Button Card */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3.5 px-4 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 hover:border-red-300 active:scale-[0.99]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out from GreenGrocc</span>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">Account Settings</h3>
              <button type="button" onClick={() => setShowSettings(false)} className="text-text-secondary">
                ✕
              </button>
            </div>
            <Link
              to="/support"
              onClick={() => setShowSettings(false)}
              className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-mobile-surface"
            >
              <span className="font-medium text-text-primary">Help & Support</span>
              <span className="text-text-secondary">›</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                logout();
                navigate("/");
              }}
              className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-3 text-left font-medium text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {showRewardsModal && (
        <RewardPointsModal
          open={showRewardsModal}
          onClose={() => setShowRewardsModal(false)}
        />
      )}
    </div>
  );
}

export default Profile;
