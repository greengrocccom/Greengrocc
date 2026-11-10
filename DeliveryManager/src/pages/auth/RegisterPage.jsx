import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCurrentStoreLocation } from "../../hooks/useCurrentStoreLocation";
import { STATES, citiesForState, cityById } from "../../constants/locations.js";
import { snapToServiceLocation } from "../../utils/matchLocation.js";
import { geocodePlace } from "../../utils/detectCurrentLocation.js";

export default function RegisterPage() {
  const { isAuthenticated, loading, register } = useAuth();
  const navigate = useNavigate();
  const { location, detecting, error: locationError, detect } = useCurrentStoreLocation({
    auto: true,
  });
  const [addressMode, setAddressMode] = useState("gps");
  const [geocoding, setGeocoding] = useState(false);
  const geocodeId = useRef(0);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    state: "",
    city: "",
    cityId: "",
    area: "",
    storeName: "",
    storeAddress: "",
    pincode: "",
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cities = citiesForState(formData.state);
  const selectedCity = cityById(formData.cityId);
  const areas = selectedCity?.areas || [];

  useEffect(() => {
    if (addressMode !== "gps" || !location) return;
    const snapped = snapToServiceLocation({
      state: location.state,
      city: location.city,
      area: location.area,
    });
    setFormData((prev) => ({
      ...prev,
      state: snapped.state || prev.state,
      city: snapped.city || prev.city,
      cityId: snapped.cityId || prev.cityId,
      area: snapped.area || prev.area,
      pincode: location.pincode || prev.pincode,
      storeAddress: location.address || prev.storeAddress,
      latitude: location.latitude ?? prev.latitude,
      longitude: location.longitude ?? prev.longitude,
    }));
  }, [location, addressMode]);

  useEffect(() => {
    if (!formData.state || !formData.city || !formData.area) return undefined;
    const timer = setTimeout(async () => {
      const req = ++geocodeId.current;
      setGeocoding(true);
      try {
        const result = await geocodePlace({
          area: formData.area,
          city: formData.city,
          state: formData.state,
        });
        if (req !== geocodeId.current || !result) return;
        setFormData((prev) => ({
          ...prev,
          pincode: result.pincode || prev.pincode,
          storeAddress: prev.storeAddress || result.address,
          latitude: Number.isFinite(result.latitude) ? result.latitude : prev.latitude,
          longitude: Number.isFinite(result.longitude) ? result.longitude : prev.longitude,
        }));
      } finally {
        if (req === geocodeId.current) setGeocoding(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.state, formData.city, formData.area]);

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onStateChange = (e) => {
    const state = e.target.value;
    setFormData((prev) => ({
      ...prev,
      state,
      city: "",
      cityId: "",
      area: "",
      pincode: "",
    }));
  };

  const onCityChange = (e) => {
    const cityId = e.target.value;
    const city = cityById(cityId);
    setFormData((prev) => ({
      ...prev,
      cityId,
      city: city?.name || "",
      area: "",
      pincode: "",
    }));
  };

  const onAreaChange = (e) => {
    setFormData((prev) => ({ ...prev, area: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!formData.state || !formData.city || !formData.area) {
      setError("Please select state, city and area");
      return;
    }

    const lat = Number(formData.latitude ?? location?.latitude);
    const lng = Number(formData.longitude ?? location?.longitude);
    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      state: formData.state,
      city: formData.city,
      cityId: formData.cityId,
      area: formData.area,
      storeName: formData.storeName,
      pincode: formData.pincode,
      storeAddress:
        formData.storeAddress ||
        [formData.area, formData.city, formData.state, formData.pincode]
          .filter(Boolean)
          .join(", "),
    };
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      payload.latitude = lat;
      payload.longitude = lng;
    }

    setSubmitting(true);
    try {
      await register(payload);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-600";
  const selectClass = `${inputClass} bg-white disabled:bg-gray-50 disabled:text-gray-400`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f7f4] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-600">
            GreenGrocc
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Register Your Store</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pick state, city and area from the list. Current location is optional.
          </p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Store location
                </p>
                {detecting ? (
                  <p className="mt-1 text-sm font-semibold text-slate-700">Detecting…</p>
                ) : addressMode === "manual" ? (
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Select state, city and area below
                  </p>
                ) : location ? (
                  <p className="mt-1 truncate text-sm font-bold text-slate-900">{location.label}</p>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {locationError || "Allow location to auto-fill, or enter the address manually"}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddressMode("gps");
                    detect().catch(() => {});
                  }}
                  disabled={detecting}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${
                    addressMode === "gps"
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {detecting ? "Locating…" : "Use current location"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddressMode("manual")}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    addressMode === "manual"
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Enter address manually
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Store Name</label>
            <input
              type="text"
              name="storeName"
              required
              value={formData.storeName}
              onChange={handleChange}
              placeholder="Your Store Name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Manager Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Your Full Name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              type="tel"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              placeholder="10-digit mobile number"
              pattern="[6-9][0-9]{9}"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
              <select
                name="state"
                required
                value={formData.state}
                onChange={onStateChange}
                className={selectClass}
              >
                <option value="">Select state</option>
                {STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
              <select
                name="cityId"
                required
                value={formData.cityId}
                onChange={onCityChange}
                disabled={!formData.state}
                className={selectClass}
              >
                <option value="">Select city</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Area / Locality</label>
            <select
              name="area"
              required
              value={formData.area}
              onChange={onAreaChange}
              disabled={!formData.cityId}
              className={selectClass}
            >
              <option value="">Select area</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pincode</label>
            <input
              type="text"
              name="pincode"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              value={formData.pincode}
              onChange={handleChange}
              placeholder="6-digit pincode"
              className={inputClass}
            />
            {geocoding ? (
              <p className="mt-1 text-xs text-gray-500">Looking up pincode…</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Store Address</label>
            <textarea
              name="storeAddress"
              value={formData.storeAddress}
              onChange={handleChange}
              placeholder="Area, city, state, pincode"
              rows="2"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              value={formData.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={6}
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm password"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-green-700 py-3 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-60"
          >
            {submitting ? "Registering…" : "Register dark store"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-green-600 hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
