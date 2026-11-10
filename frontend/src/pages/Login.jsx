import React, { useState, useEffect, useRef } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { sendOtpLogin, resendOtpLogin } from "../api/api";
import toast from "react-hot-toast";
import OptimizedImg from "../components/common/OptimizedImg";

const PHONE_PATTERN = /^[6789]\d{9}$/;

export default function Login() {
  const { login, loginWithOtp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // "otp" (default) or "password"
  const [authMode, setAuthMode] = useState("otp");
  
  // OTP flow states
  const [otpStep, setOtpStep] = useState("phone"); // "phone" | "verify"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Password flow states
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & modal states
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [unblockPhone, setUnblockPhone] = useState("");
  const [unblockReason, setUnblockReason] = useState("");
  const [unblockSubmitting, setUnblockSubmitting] = useState(false);
  const [unblockSuccess, setUnblockSuccess] = useState("");
  const [unblockError, setUnblockError] = useState("");

  const otpInputRef = useRef(null);
  const timerRef = useRef(null);
  const redirectTo = location.state?.from || "/";

  // Countdown timer for OTP
  useEffect(() => {
    if (otpStep === "verify" && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [otpStep, timer]);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = () => {
    if (location.state?.from && location.state.from !== "/login" && location.state.from !== "/signup") {
      navigate(location.state.from);
    } else {
      navigate("/");
    }
  };

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  // --- OTP Flow: Send OTP ---
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);

    if (!PHONE_PATTERN.test(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setSubmitting(true);
    try {
      // Uses MSG91 template: GreenGrocc Customer Login OTP (template 3)
      const res = await sendOtpLogin({ phone: cleanPhone, purpose: "login" });
      setOtpStep("verify");
      setTimer(30);
      setCanResend(false);
      setOtp("");
      toast.success(res.data?.message || "OTP sent to your mobile number");
      setTimeout(() => otpInputRef.current?.focus(), 150);
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.isBlocked) {
        setIsBlocked(true);
        setBlockReason(respData?.blockReason || "");
        setUnblockPhone(cleanPhone);
      }
      setError(respData?.message || err.message || "Failed to send OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- OTP Flow: Resend OTP ---
  const handleResendOtp = async () => {
    if (!canResend) return;
    setError("");
    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);

    setSubmitting(true);
    try {
      const res = await resendOtpLogin({ phone: cleanPhone, purpose: "login" });
      setTimer(30);
      setCanResend(false);
      toast.success(res.data?.message || "New OTP sent successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setSubmitting(false);
    }
  };

  // --- OTP Flow: Verify OTP & Login ---
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
    const cleanOtp = otp.trim().replace(/\D/g, "");

    if (cleanOtp.length < 4 || cleanOtp.length > 6) {
      setError("Please enter the 6-digit OTP code");
      return;
    }

    setSubmitting(true);
    try {
      await loginWithOtp({ phone: cleanPhone, otp: cleanOtp });
      toast.success("Signed in successfully!");
      navigate("/location", { replace: true, state: { returnTo: redirectTo } });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Password Flow: Login ---
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsBlocked(false);

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setError("Please enter your email or phone number");
      return;
    }

    const isEmail = cleanInput.includes("@");
    let loginPayload = {};

    if (isEmail) {
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
      toast.success("Signed in successfully!");
      navigate("/location", { replace: true, state: { returnTo: redirectTo } });
    } catch (err) {
      const respData = err.response?.data;
      if (respData?.isBlocked) {
        setIsBlocked(true);
        setBlockReason(respData?.blockReason || "");
        setUnblockPhone(cleanInput.replace(/\D/g, "").slice(-10));
      }
      setError(respData?.message || err.message || "Sign in failed. Please check credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblockSubmit = async (e) => {
    e.preventDefault();
    const cleanPhone = unblockPhone.trim().replace(/\D/g, "").slice(-10);
    if (!PHONE_PATTERN.test(cleanPhone)) {
      setUnblockError("Please enter a valid 10-digit mobile number");
      return;
    }
    if (!unblockReason.trim() || unblockReason.trim().length < 5) {
      setUnblockError("Please provide a reason (at least 5 characters)");
      return;
    }

    setUnblockSubmitting(true);
    setUnblockError("");
    setUnblockSuccess("");

    try {
      const res = await api.post("/api/users/unblock-request", {
        phone: cleanPhone,
        reason: unblockReason.trim(),
      });
      setUnblockSuccess(
        res.data?.message ||
          "Unblock request submitted successfully. Our team will review your account."
      );
      setUnblockReason("");
    } catch (err) {
      setUnblockError(
        err.response?.data?.message || err.message || "Failed to submit request. Please try again."
      );
    } finally {
      setUnblockSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Modal Box: Clean, Responsive Popup (Zero Images, Proper Only Form) */}
      <div
        className="relative my-auto w-full max-w-[420px] bg-white rounded-3xl shadow-2xl p-5 sm:p-7 z-[121] max-h-[94vh] overflow-y-auto flex flex-col justify-between animate-in zoom-in-95 duration-200 select-none border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button (X) */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer z-30"
          aria-label="Close Modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Top Header Section: Logo + Tab Switcher */}
        <div className="flex flex-col items-center text-center">
          {/* Brand Logo */}
          <Link to="/" onClick={handleClose} className="inline-block transition-transform active:scale-98">
            <OptimizedImg
              src="/assets/payment/logo.png"
              alt="GreenGrocc Logo"
              className="h-10 sm:h-11 w-auto object-contain mx-auto"
            />
          </Link>

          {/* Navigation Tab Switcher: Sign In / Sign Up */}
          <div className="flex items-center justify-center mt-3.5 mb-2 w-full">
            <div className="inline-flex p-1 rounded-full border border-gray-200 bg-gray-50/90 w-full max-w-[260px]">
              <Link
                to="/login"
                className="flex-1 py-1.5 text-center text-xs font-bold rounded-full bg-[#075e34] text-white shadow-xs transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="flex-1 py-1.5 text-center text-xs font-bold rounded-full text-gray-600 hover:text-gray-900 transition-all"
              >
                Sign Up
              </Link>
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mt-1">
            {otpStep === "verify" ? "Verify Mobile OTP" : "Welcome Back!"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xs mx-auto leading-relaxed">
            {otpStep === "verify"
              ? `Enter 6-digit code sent to +91 ${phone}`
              : "Sign in to continue your fresh & healthy shopping"}
          </p>

          {/* Login Mode Toggle: OTP vs Password */}
          {otpStep === "phone" && (
            <div className="flex items-center justify-center gap-4 mt-3 pt-1 border-t border-gray-100 w-full text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("otp");
                  setError("");
                }}
                className={`pb-1 font-bold transition-all cursor-pointer border-b-2 ${
                  authMode === "otp"
                    ? "border-[#075e34] text-[#075e34]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                📱 Login with OTP
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("password");
                  setError("");
                }}
                className={`pb-1 font-bold transition-all cursor-pointer border-b-2 ${
                  authMode === "password"
                    ? "border-[#075e34] text-[#075e34]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                🔒 Password Login
              </button>
            </div>
          )}
        </div>

        {/* Center Form Section (Proper Only Form, Zero Images) */}
        <div className="my-auto py-2.5 w-full">
          {error && (
            <div className="mb-3 p-2.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
              {error}
              {isBlocked && (
                <button
                  type="button"
                  onClick={() => setShowUnblockModal(true)}
                  className="block mt-1.5 text-xs font-bold text-red-700 underline cursor-pointer"
                >
                  Request Account Review
                </button>
              )}
            </div>
          )}

          {/* Flow 1: Login with OTP */}
          {authMode === "otp" ? (
            otpStep === "phone" ? (
              // Step 1: Mobile Number Input
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                  <span className="text-[13.5px] font-bold text-gray-600 mr-2 border-r border-gray-200 pr-2">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                      setError("");
                    }}
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    className="w-full bg-transparent text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none font-medium"
                    autoComplete="tel"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-[#075e34] hover:bg-[#064e2b] active:scale-[0.98] text-white font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  <span>{submitting ? "Sending OTP..." : "Get OTP"}</span>
                  {!submitting && (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </form>
            ) : (
              // Step 2: OTP Verification Screen
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500 pb-0.5">
                  <span>Mobile: <strong className="text-gray-900">+91 {phone}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep("phone");
                      setError("");
                    }}
                    className="font-bold text-[#075e34] hover:underline cursor-pointer"
                  >
                    Edit Number
                  </button>
                </div>

                <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                  <svg className="w-5 h-5 text-gray-400 mr-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <input
                    ref={otpInputRef}
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setError("");
                    }}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="w-full bg-transparent text-[16px] tracking-widest text-gray-900 placeholder:text-gray-400 placeholder:tracking-normal focus:outline-none font-bold"
                    autoComplete="one-time-code"
                    required
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                  {timer > 0 ? (
                    <span>Resend OTP in <strong className="text-gray-800">{timer}s</strong></span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={submitting}
                      className="font-bold text-[#075e34] hover:underline cursor-pointer"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || otp.length < 4}
                  className="w-full h-11 bg-[#075e34] hover:bg-[#064e2b] active:scale-[0.98] text-white font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  <span>{submitting ? "Verifying..." : "Verify & Sign In"}</span>
                  {!submitting && (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  )}
                </button>
              </form>
            )
          ) : (
            // Flow 2: Password Login
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              {/* Email / Mobile Field */}
              <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <svg className="w-4.5 h-4.5 text-gray-400 mr-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError("");
                  }}
                  placeholder="Email Address or Mobile"
                  className="w-full bg-transparent text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  autoComplete="username"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="relative flex items-center rounded-2xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 focus-within:bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
                <svg className="w-4.5 h-4.5 text-gray-400 mr-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
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
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-[12px] text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 border-gray-300 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowUnblockModal(true)}
                  className="text-[12px] font-bold text-[#075e34] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-[#075e34] hover:bg-[#064e2b] active:scale-[0.98] text-white font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? "Signing in..." : "Sign In with Password"}</span>
                {!submitting && (
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Section */}
        <div className="w-full pt-1 pb-0.5">

          {/* Footer Link */}
          <div className="text-center pt-3 pb-0.5 text-[12.5px] text-gray-500">
            Don't have an account?{" "}
            <Link to="/signup" className="font-bold text-[#075e34] hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password / Unblock Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Account Recovery</h3>
            <p className="mt-1 text-xs text-gray-500">
              Enter your registered mobile number and reason. Our support team will assist you.
            </p>
            {unblockSuccess ? (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-medium">
                {unblockSuccess}
                <button
                  type="button"
                  onClick={() => setShowUnblockModal(false)}
                  className="mt-3 block w-full rounded-full bg-[#075e34] py-2 text-white font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleUnblockSubmit} className="mt-4 space-y-3">
                {unblockError && (
                  <p className="p-2.5 rounded-lg bg-red-50 text-red-600 text-xs">{unblockError}</p>
                )}
                <input
                  type="tel"
                  value={unblockPhone}
                  onChange={(e) => setUnblockPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm"
                  required
                />
                <textarea
                  value={unblockReason}
                  onChange={(e) => setUnblockReason(e.target.value)}
                  placeholder="Tell us what you need help with..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm"
                  required
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowUnblockModal(false)}
                    className="flex-1 rounded-full border border-gray-200 py-2.5 text-xs font-bold text-gray-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={unblockSubmitting}
                    className="flex-1 rounded-full bg-[#075e34] py-2.5 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
                  >
                    {unblockSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
