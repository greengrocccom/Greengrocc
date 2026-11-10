import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCurrentStoreLocation } from "../../hooks/useCurrentStoreLocation";

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const { location, detecting, error: locationError, detect } = useCurrentStoreLocation({
    auto: true,
  });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = identifier.trim();
    const payload = {
      identifier: trimmed,
      email: trimmed,
      phone: trimmed,
      password,
    };
    if (location?.latitude != null && location?.longitude != null) {
      payload.latitude = location.latitude;
      payload.longitude = location.longitude;
    }

    setSubmitting(true);
    try {
      await login(payload);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f7f4] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-primary">
            GreenGrocc
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Delivery Manager Login</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to manage your dark store. Location is optional.
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Store location
              </p>
              {detecting ? (
                <p className="mt-1 text-sm font-semibold text-slate-700">Detecting current location…</p>
              ) : location ? (
                <>
                  <p className="mt-1 truncate text-sm font-bold text-slate-900">
                    {location.label}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {location.address || `${location.city || ""}${location.state ? `, ${location.state}` : ""}`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {locationError || "Location is optional — you can sign in without it"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => detect().catch(() => {})}
              disabled={detecting}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {detecting ? "Locating…" : location ? "Refresh" : "Use location"}
            </button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email or Mobile Number</label>
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. manager@greengrocc.com or 9876543210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-green-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-green-primary"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-green-dark py-3 text-sm font-semibold text-white hover:bg-green-primary disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Your multivendor must request your dark store login and admin must approve it. Contact your multivendor for access.
        </p>
      </div>
    </div>
  );
}
