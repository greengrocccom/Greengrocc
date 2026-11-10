import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(form);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold text-gray-900">Product Manager</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review restock requests sent by dark stores
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <label className="mt-5 block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="pm@greengrocc.com"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2"
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-green-primary py-2.5 text-sm font-semibold text-white hover:bg-green-active disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
