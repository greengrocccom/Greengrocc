import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import OptimizedImg from "../common/OptimizedImg";

const PHONE_PATTERN = /^[6789]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EyeIcon({ open, className = "h-4 w-4" }) {
  if (open) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AuthModal({ mode, onClose, onSwitchMode }) {
  const { login, signup } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  const resetForm = () => {
    setIdentifier("");
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
  };

  const handleModeSwitch = (nextMode) => {
    resetForm();
    onSwitchMode(nextMode);
  };

  useEffect(() => {
    resetForm();
  }, [mode]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!isSignup) {
      // Login flow
      const cleanInput = identifier.trim();
      if (!cleanInput) {
        setError("Please enter your email or phone number");
        return;
      }
      const isEmail = cleanInput.includes("@");
      let loginPayload = {};

      if (isEmail) {
        if (!EMAIL_PATTERN.test(cleanInput)) {
          setError("Please enter a valid email address");
          return;
        }
        loginPayload = { email: cleanInput.toLowerCase(), password };
      } else {
        const cleanPhone = cleanInput.replace(/\D/g, "").slice(-10);
        if (!PHONE_PATTERN.test(cleanPhone)) {
          setError("Please enter a valid 10-digit mobile number or email");
          return;
        }
        loginPayload = { phone: cleanPhone, password };
      }

      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      setSubmitting(true);
      try {
        await login(loginPayload);
        onClose();
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Sign in failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Signup flow
      if (!name.trim() || name.trim().length < 2) {
        setError("Please enter your full name (at least 2 characters)");
        return;
      }
      const cleanPhone = phone.trim().replace(/\D/g, "");
      if (!PHONE_PATTERN.test(cleanPhone)) {
        setError("Phone number must be 10 digits starting with 6, 7, 8, or 9");
        return;
      }
      if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
        setError("Please enter a valid email address");
        return;
      }
      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (!agreedToTerms) {
        setError("Please agree to the Terms & Conditions and Privacy Policy");
        return;
      }

      setSubmitting(true);
      try {
        const payload = {
          name: name.trim(),
          phone: cleanPhone,
          password: password.trim(),
          accountType: "retail",
          ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
        };
        await signup(payload);
        onClose();
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Failed to create account. Please try again.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 p-2 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative my-auto w-full max-w-[420px] rounded-3xl bg-white text-gray-900 shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow-sm transition hover:bg-white hover:text-gray-900 cursor-pointer"
          aria-label="Close"
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header Branding (No image) */}
        <div className="pt-6 pb-2 px-6 text-center flex-shrink-0">
          <OptimizedImg
            src="/assets/payment/logo.png"
            alt="GreenGrocc Logo"
            className="h-10 w-auto object-contain mx-auto"
          />
          <h2 className="text-xl font-black text-gray-900 tracking-tight mt-2">
            {isSignup ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSignup
              ? "Join GreenGrocc for farm-fresh produce delivered fast"
              : "Sign in to continue your fresh grocery shopping"}
          </p>
        </div>

        {/* Scrollable Form Body */}
        <div className="px-5 sm:px-6 pt-3 pb-5 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}

            {!isSignup ? (
              <>
                {/* Email / Phone Field */}
                <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                  <svg
                    className="w-4.5 h-4.5 text-gray-400 mr-2.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError("");
                    }}
                    placeholder="Email Address"
                    className="w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                  <svg
                    className="w-4.5 h-4.5 text-gray-400 mr-2.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Password"
                    className="w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none pr-2"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Full Name & Phone Number */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white px-3 py-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-500/10">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError("");
                      }}
                      placeholder="Full Name"
                      className="w-full bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none min-w-0"
                      required
                    />
                  </div>
                  <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white px-3 py-2.5 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-500/10">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                        setError("");
                      }}
                      placeholder="Phone Number"
                      maxLength={10}
                      className="w-full bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none min-w-0"
                      required
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="Email Address"
                    className="w-full bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                {/* Password */}
                <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Password"
                    className="w-full bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none pr-2"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="relative flex items-center rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Confirm Password"
                    className="w-full bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none pr-2"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>

                {/* Terms Checkbox */}
                <label className="flex items-center gap-2 pt-0.5 text-[11.5px] text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-gray-300 cursor-pointer"
                  />
                  <span>I agree to Terms & Conditions and Privacy Policy</span>
                </label>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 sm:h-12 bg-[#075e34] hover:bg-[#064e2b] active:scale-[0.98] text-white font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <span>{submitting ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}</span>
              {!submitting && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              )}
            </button>
          </form>

          {/* Switch Mode Footer */}
          <div className="text-center pt-3 pb-1 text-[13px] text-gray-500">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("login")}
                  className="font-bold text-[#075e34] hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signup")}
                  className="font-bold text-[#075e34] hover:underline cursor-pointer"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default AuthModal;
